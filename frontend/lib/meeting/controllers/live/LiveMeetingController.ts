import {
  applyEvent,
  CommandAckSchema,
  createInitialSnapshot,
  PROTOCOL_VERSION,
  ServerEventSchema,
  SOCKET_COMMAND_CHANNEL,
  SOCKET_EVENT_CHANNEL,
  type ClientCommandOf,
  type ConnectionState,
  type MeetingSnapshot,
  type ProtocolError,
} from "@roundtable/shared";
import { io, type Socket } from "socket.io-client";
import type { MeetingCapabilities, MeetingController } from "@/lib/meeting/types";

export interface LiveMeetingControllerOptions {
  roomId: string;
  serverUrl: string;
  /** Socket factory; injectable for tests. */
  connect?: (serverUrl: string) => Socket;
  /** How long to wait for a command acknowledgement. */
  ackTimeoutMs?: number;
}

const DEFAULT_ACK_TIMEOUT_MS = 8000;

/** Commands held while not joined. Bounded so a long outage can't grow memory. */
const MAX_QUEUED_COMMANDS = 20;

/**
 * Room commands that still mean the same thing after a reconnect, so they
 * are queued while disconnected. `user.interrupt` is deliberately not: "cut
 * off whoever is speaking" delivered seconds later would hit an unrelated turn.
 */
type QueueableCommand = ClientCommandOf<"user.message.send"> | ClientCommandOf<"room.end">;

interface PendingCommand {
  command: QueueableCommand | ClientCommandOf<"user.interrupt">;
  /** Identifies one transmission; acks for superseded transmissions are ignored. */
  attempt: number;
}

function defaultConnect(serverUrl: string): Socket {
  return io(serverUrl, {
    transports: ["websocket"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
}

/** 128 random bits as hex; works outside secure contexts, unlike randomUUID. */
function newClientMsgId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const UNREACHABLE: ProtocolError = {
  code: "internal_error",
  message: "Couldn't reach the room server. Your last action may not have been received.",
  retryable: true,
};

const QUEUE_FULL: ProtocolError = {
  code: "internal_error",
  message: "Still reconnecting — too many actions are waiting. Please try again shortly.",
  retryable: true,
};

/**
 * MeetingController backed by the room server over Socket.IO.
 *
 * Server events are validated, then folded into the snapshot by the same
 * shared reducer the mock uses; the UI can't tell the two apart. On every
 * (re)connect it joins with the last applied seq and receives a fresh
 * room.snapshot, so reconnects always converge on server state.
 *
 * Room commands are only ever emitted on a connection that has completed
 * room.join. Until then they wait in this controller's own queue — never in
 * Socket.IO's packet buffer, which would flush them before the rejoin. A
 * command whose acknowledgement was lost to a disconnect is re-sent after
 * the next join with the same clientMsgId; the server's duplicate
 * protection guarantees it still runs at most once.
 */
export class LiveMeetingController implements MeetingController {
  // Challenge and Add Perspective arrive on the server in Phase 2A.
  readonly capabilities: MeetingCapabilities = { challenge: false, addPerspective: false };

  private snapshot: MeetingSnapshot;
  private readonly listeners = new Set<() => void>();
  private socket: Socket | null = null;

  /** True only once room.join has succeeded on the current connection. */
  private joined = false;
  /** Increments on every connect; join acks from older connections are ignored. */
  private connectionEpoch = 0;
  /** The room no longer exists: nothing is queued or retried. */
  private roomGone = false;
  /** Waiting for a joined connection, in send order. */
  private queue: PendingCommand[] = [];
  /** Sent on the current connection and not yet acknowledged, in send order. */
  private readonly inFlight = new Map<string, PendingCommand>();
  private attempts = 0;

  constructor(private readonly options: LiveMeetingControllerOptions) {
    this.snapshot = createInitialSnapshot(options.roomId, { connection: "connecting" });
  }

  /* ---------------- Store interface ---------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): MeetingSnapshot => this.snapshot;

  getElapsedSeconds = (): number => {
    const { ended, durationSeconds, startedAt } = this.snapshot;
    if (ended) return durationSeconds;
    if (startedAt === null) return 0;
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  };

  /* ---------------- Lifecycle ---------------- */

  start(): void {
    if (this.socket) return;

    const socket = (this.options.connect ?? defaultConnect)(this.options.serverUrl);
    this.socket = socket;
    this.joined = false;
    if (this.snapshot.connection !== "offline") this.setConnection("connecting");

    socket.on("connect", () => {
      if (this.socket !== socket) return;
      this.joined = false;
      this.join(socket, ++this.connectionEpoch);
    });
    socket.on(SOCKET_EVENT_CHANNEL, (raw: unknown) => {
      if (this.socket === socket) this.receive(raw);
    });
    socket.on("disconnect", () => {
      if (this.socket !== socket) return;
      this.joined = false;
      // Unacknowledged commands may or may not have arrived: resend after
      // the next join. Duplicate protection makes that safe either way.
      this.requeueInFlight();
      if (this.snapshot.connection !== "offline") this.setConnection("reconnecting");
    });
    socket.on("connect_error", () => {
      if (this.socket !== socket || this.snapshot.connection === "offline") return;
      this.setConnection("reconnecting");
    });
  }

  /**
   * Disconnects for good. Pending commands are discarded and every late
   * event, ack or timeout from this socket is ignored.
   */
  stop(): void {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null;
    this.joined = false;
    this.queue = [];
    this.inFlight.clear();
    socket.removeAllListeners();
    socket.disconnect();
  }

  /* ---------------- User actions ---------------- */

  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.snapshot.ended) return;
    this.submit({ ...this.envelope(), type: "user.message.send", payload: { text: trimmed } });
  }

  interrupt(): void {
    if (this.snapshot.ended) return;
    // Only meaningful right now; never queued for after a reconnect.
    if (this.canTransmit()) {
      this.transmit({ command: { ...this.envelope(), type: "user.interrupt", payload: {} }, attempt: 0 });
    }
  }

  end(): void {
    if (this.snapshot.ended) return;
    this.submit({ ...this.envelope(), type: "room.end", payload: {} });
  }

  /** Not supported by the room server yet; the UI disables it via capabilities. */
  challengeRoom(): void {}

  /** Not supported by the room server yet; the UI disables it via capabilities. */
  addPerspective(): void {}

  /* ---------------- Protocol ---------------- */

  private join(socket: Socket, epoch: number): void {
    const command: ClientCommandOf<"room.join"> = {
      ...this.envelope(),
      type: "room.join",
      payload: { roomId: this.options.roomId, lastSeq: this.snapshot.seq },
    };

    socket.timeout(this.ackTimeout).emit(SOCKET_COMMAND_CHANNEL, command, (err: Error | null, raw: unknown) => {
      // A reply for a stopped controller or an older connection is stale.
      if (this.socket !== socket || epoch !== this.connectionEpoch) return;

      if (err) {
        // The connection is likely failing; Socket.IO reconnects and we rejoin then.
        this.patch({ lastError: UNREACHABLE });
        return;
      }

      const ack = CommandAckSchema.safeParse(raw);
      if (!ack.success) return;

      if (ack.data.ok) {
        this.joined = true;
        this.patch({ connection: "live", lastError: null });
        this.flush();
      } else if (ack.data.error.code === "room_not_found") {
        this.abandonRoom(socket, ack.data.error);
      } else {
        this.patch({ lastError: ack.data.error });
      }
    });
  }

  /** Sends now if joined, otherwise queues until the next successful join. */
  private submit(command: QueueableCommand): void {
    if (!this.socket || this.roomGone) return;

    const pending: PendingCommand = { command, attempt: 0 };
    if (this.canTransmit()) {
      this.transmit(pending);
      return;
    }
    if (this.queue.length >= MAX_QUEUED_COMMANDS) {
      this.patch({ lastError: QUEUE_FULL });
      return;
    }
    this.queue.push(pending);
  }

  /** Emits on the current, joined connection and tracks it until acknowledged. */
  private transmit(pending: PendingCommand): void {
    const socket = this.socket;
    if (!socket) return;

    const { clientMsgId } = pending.command;
    const attempt = ++this.attempts;
    pending.attempt = attempt;
    this.inFlight.set(clientMsgId, pending);

    socket.timeout(this.ackTimeout).emit(SOCKET_COMMAND_CHANNEL, pending.command, (err: Error | null, raw: unknown) => {
      if (this.socket !== socket) return;
      // Re-queued (or re-sent) since this transmission: not ours to settle.
      if (this.inFlight.get(clientMsgId)?.attempt !== attempt) return;

      if (err) {
        // Disconnected: the disconnect handler has already re-queued it.
        if (!socket.connected) return;
        this.inFlight.delete(clientMsgId);
        this.patch({ lastError: UNREACHABLE });
        return;
      }

      this.inFlight.delete(clientMsgId);
      const ack = CommandAckSchema.safeParse(raw);
      if (ack.success && !ack.data.ok) this.patch({ lastError: ack.data.error });
    });
  }

  /** Sends everything that waited for the join, in original order. */
  private flush(): void {
    const pending = this.queue;
    this.queue = [];
    for (const item of pending) this.transmit(item);
  }

  /** Moves unacknowledged commands back to the front of the queue. */
  private requeueInFlight(): void {
    if (this.inFlight.size === 0) return;
    // A queued interrupt is stale after a reconnect; drop it.
    const resend = [...this.inFlight.values()].filter((p) => p.command.type !== "user.interrupt");
    this.inFlight.clear();
    this.queue = [...resend, ...this.queue];
  }

  /** The room is gone: drop pending work, surface the error, stop retrying. */
  private abandonRoom(socket: Socket, error: ProtocolError): void {
    this.roomGone = true;
    this.joined = false;
    this.queue = [];
    this.inFlight.clear();
    this.patch({ connection: "offline", lastError: error });
    socket.disconnect();
  }

  private receive(raw: unknown): void {
    const parsed = ServerEventSchema.safeParse(raw);
    // Malformed or foreign-version events are dropped rather than trusted.
    if (!parsed.success) return;

    const next = applyEvent(this.snapshot, parsed.data);
    if (next === this.snapshot) return;
    this.snapshot = next;
    this.notify();
  }

  /* ---------------- Internals ---------------- */

  private canTransmit(): boolean {
    return this.socket !== null && this.socket.connected && this.joined;
  }

  private envelope() {
    return { v: PROTOCOL_VERSION, clientMsgId: newClientMsgId() };
  }

  private get ackTimeout(): number {
    return this.options.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
  }

  private setConnection(connection: ConnectionState): void {
    if (this.snapshot.connection !== connection) this.patch({ connection });
  }

  /** Client-only fields (connection, lastError); server state goes through the reducer. */
  private patch(fields: Partial<Pick<MeetingSnapshot, "connection" | "lastError">>): void {
    this.snapshot = { ...this.snapshot, ...fields };
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
