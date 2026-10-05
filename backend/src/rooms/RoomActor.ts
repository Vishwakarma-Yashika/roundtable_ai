import { randomUUID } from "node:crypto";
import {
  applyEvent,
  createEvent,
  createInitialSnapshot,
  MAX_ROOM_MESSAGES,
  MESSAGE_MAX_LENGTH,
  PROTOCOL_VERSION,
  toParticipant,
  toRoomState,
  type ClientCommand,
  type CommandAck,
  type MeetingSnapshot,
  type Message,
  type Persona,
  type ProtocolError,
  type RoomPhase,
  type RoomState,
  type ServerEvent,
  type ServerEventOf,
  type ServerEventPayload,
  type ServerEventType,
  type TurnIntent,
} from "@roundtable/shared";
import { isAbortError, type AgentResponse, type LlmProvider, type TurnContext } from "../llm/LlmProvider";
import { canTransition, isAllowed, isLive, type ActorOperation } from "./lifecycle";

export interface RoomTiming {
  /** How long a speaker holds the floor after their message lands. */
  speakingMs: (text: string) => number;
  /** Agent reactions queued after each reply to a user message. */
  reactionsPerUserMessage: number;
}

export const DEFAULT_TIMING: RoomTiming = {
  speakingMs: (text) => Math.min(4200, Math.max(1400, text.length * 22)),
  reactionsPerUserMessage: 1,
};

export interface RoomActorOptions {
  roomId: string;
  decision: string;
  personas: Persona[];
  llm: LlmProvider;
  /** Receives every event, in seq order, for broadcasting. */
  onEvent: (event: ServerEvent) => void;
  timing?: Partial<RoomTiming>;
  now?: () => number;
  /** Reports unexpected internal errors (bugs); the room keeps running. */
  onError?: (error: unknown) => void;
  /**
   * Message history bound; tests lower it. Clamped to MAX_ROOM_MESSAGES so
   * the room's state always satisfies the shared schema.
   */
  maxMessages?: number;
}

/** Commands that reach the actor; room.join is handled by the gateway. */
export type RoomCommand = Exclude<ClientCommand, { type: "room.join" }>;

export type OperationResult = { ok: true } | { ok: false; error: ProtocolError };

interface TurnRequest {
  speakerId: string;
  intent: TurnIntent;
  /** Message the speaker should respond to. */
  respondToMessageId?: string;
}

interface ActiveTurn {
  turnId: string;
  speakerId: string;
  intent: TurnIntent;
  respondToMessageId?: string;
  abort: AbortController;
  stage: "generating" | "speaking";
  message?: Message;
  speakingTimer?: ReturnType<typeof setTimeout>;
}

const TRANSCRIPT_WINDOW = 8;
const MAX_REMEMBERED_COMMANDS = 256;

/**
 * Owns one room. The ONLY component allowed to change room state.
 *
 * - Every operation — client commands and internal completions alike —
 *   runs through a single promise-chain mailbox, so they are processed
 *   strictly one at a time, in arrival order.
 * - LLM calls run outside the mailbox; their results re-enter it as
 *   internal commands tagged with the turnId they belong to. A result whose
 *   turn is no longer active (interrupted, ended, superseded) is ignored,
 *   even if the provider never honoured the abort signal.
 * - State is the shared reducer applied to the actor's own events: the
 *   exact fold every client performs, so server and client can't diverge.
 */
export class RoomActor {
  readonly roomId: string;
  readonly createdAt: number;

  private state: MeetingSnapshot;
  private seq = 0;
  private mailbox: Promise<unknown> = Promise.resolve();
  private activeTurn: ActiveTurn | null = null;
  private pendingTurns: TurnRequest[] = [];
  private turnCount = 0;
  private readonly turnsBySpeaker = new Map<string, number>();
  private readonly commandResults = new Map<string, Promise<CommandAck>>();
  private readonly personas: Map<string, Persona>;
  private readonly timing: RoomTiming;
  private readonly now: () => number;
  private readonly maxMessages: number;
  private disposed = false;
  /** Results that arrived for turns no longer active. Exposed for tests and metrics. */
  staleResultsIgnored = 0;

  constructor(private readonly options: RoomActorOptions) {
    this.roomId = options.roomId;
    this.now = options.now ?? Date.now;
    this.createdAt = this.now();
    this.timing = { ...DEFAULT_TIMING, ...options.timing };
    this.maxMessages = Math.max(2, Math.min(options.maxMessages ?? MAX_ROOM_MESSAGES, MAX_ROOM_MESSAGES));
    this.personas = new Map(options.personas.map((p) => [p.id, p]));
    this.state = createInitialSnapshot(options.roomId, { decision: options.decision, connection: "live" });

    for (const persona of options.personas) {
      this.emit("participant.joined", { participant: toParticipant(persona) });
    }
  }

  /* ---------------------------------------------------------
     Public API — everything goes through the mailbox
  --------------------------------------------------------- */

  get phase(): RoomPhase {
    return this.state.phase;
  }

  getState(): RoomState {
    return toRoomState(this.state);
  }

  /** Full state for a joining client, at the current seq. Does not advance seq. */
  snapshotEvent(): ServerEventOf<"room.snapshot"> {
    return createEvent("room.snapshot", { state: this.getState() }, {
      roomId: this.roomId,
      seq: this.seq,
      ts: this.now(),
    });
  }

  start(): Promise<OperationResult> {
    return this.enqueue(() => {
      const denied = this.deny("start");
      if (denied) return denied;

      this.transition("opening", { startedAt: this.now() });
      const agents = [...this.personas.values()].filter((p) => p.kind === "agent");
      const moderator = [...this.personas.values()].find((p) => p.kind === "moderator");

      this.pendingTurns = [
        ...(moderator ? [{ speakerId: moderator.id, intent: "opening" as const }] : []),
        ...agents.map((agent) => ({ speakerId: agent.id, intent: "opening" as const })),
        ...(moderator ? [{ speakerId: moderator.id, intent: "moderation" as const }] : []),
      ];
      this.advance();
      return { ok: true };
    });
  }

  /**
   * Runs a client command exactly once per clientMsgId. A retried command
   * gets the original acknowledgement without being executed again.
   */
  handle(command: RoomCommand): Promise<CommandAck> {
    const existing = this.commandResults.get(command.clientMsgId);
    if (existing) return existing;

    const result = this.enqueue(() => this.execute(command)).then((outcome) =>
      toAck(command.clientMsgId, outcome)
    );
    this.remember(command.clientMsgId, result);
    return result;
  }

  /** Stops all work. Used when the registry evicts the room or the server shuts down. */
  dispose(): void {
    this.disposed = true;
    this.cancelActiveTurn();
    this.pendingTurns = [];
  }

  /* ---------------------------------------------------------
     Commands
  --------------------------------------------------------- */

  private execute(command: RoomCommand): OperationResult {
    switch (command.type) {
      case "user.message.send":
        return this.userMessage(command.clientMsgId, command.payload.text);
      case "user.interrupt":
        return this.interrupt();
      case "room.end":
        return this.end();
    }
  }

  private userMessage(clientMsgId: string, text: string): OperationResult {
    const denied = this.deny("userMessage");
    if (denied) return denied;

    // Speaking interrupts whoever holds the floor and replaces the plan.
    this.cutOff("user_message");
    this.pendingTurns = [];

    const message: Message = {
      id: randomUUID(),
      kind: "user",
      text: text.slice(0, MESSAGE_MAX_LENGTH),
      tone: "default",
      at: this.elapsedSeconds(),
      status: "complete",
    };
    this.makeRoomForMessage();
    this.emit("user.message.accepted", { clientMsgId, message });

    // The user taking the floor ends the opening round.
    if (this.state.phase === "opening") this.transition("debate");

    const responder = this.pickResponder(text);
    if (responder) {
      this.pendingTurns.push({ speakerId: responder.id, intent: "reply", respondToMessageId: message.id });
      for (let i = 0; i < this.timing.reactionsPerUserMessage; i++) {
        this.pendingTurns.push({ speakerId: "", intent: "reaction" });
      }
    }
    this.advance();
    return { ok: true };
  }

  private interrupt(): OperationResult {
    const denied = this.deny("interrupt");
    if (denied) return denied;

    this.cutOff("user_interrupt");
    this.pendingTurns = [];
    if (this.state.phase === "opening") this.transition("debate");
    return { ok: true };
  }

  private end(): OperationResult {
    const denied = this.deny("end");
    if (denied) return denied;

    this.cutOff("room_ended");
    this.pendingTurns = [];
    const durationSeconds = this.elapsedSeconds();
    this.makeRoomForMessage();
    this.emit("message.completed", {
      message: {
        id: randomUUID(),
        kind: "system",
        text: "Meeting ended",
        tone: "default",
        at: durationSeconds,
        status: "complete",
      },
    });
    this.emit("room.ended", { reason: "user", durationSeconds });
    return { ok: true };
  }

  /* ---------------------------------------------------------
     Turns
  --------------------------------------------------------- */

  /** Starts the next planned turn if the floor is free. */
  private advance(): void {
    if (this.activeTurn || this.disposed || !isLive(this.state.phase)) return;

    let request = this.pendingTurns.shift();
    while (request) {
      const resolved = this.resolveSpeaker(request);
      if (resolved) {
        this.startTurn(resolved);
        return;
      }
      request = this.pendingTurns.shift();
    }

    // Opening statements are done: the floor opens up.
    if (this.state.phase === "opening") this.transition("debate");
  }

  private startTurn(request: TurnRequest): void {
    const persona = this.personas.get(request.speakerId);
    if (!persona) return;

    const turnId = randomUUID();
    const abort = new AbortController();
    this.turnCount++;
    this.turnsBySpeaker.set(persona.id, (this.turnsBySpeaker.get(persona.id) ?? 0) + 1);
    this.activeTurn = {
      turnId,
      speakerId: persona.id,
      intent: request.intent,
      respondToMessageId: request.respondToMessageId,
      abort,
      stage: "generating",
    };
    this.emit("turn.started", { turnId, speakerId: persona.id, intent: request.intent });

    const respondTo = request.respondToMessageId
      ? this.state.messages.find((m) => m.id === request.respondToMessageId)
      : undefined;

    this.options.llm
      .generateAgentResponse({
        persona,
        context: this.buildContext(),
        instruction: {
          intent: request.intent,
          ...(respondTo && { respondTo: { authorName: this.authorName(respondTo), text: respondTo.text } }),
        },
        signal: abort.signal,
      })
      .then(
        (response) => this.post(() => this.onGenerated(turnId, response)),
        (error: unknown) => this.post(() => this.onGenerationFailed(turnId, error))
      );
  }

  private onGenerated(turnId: string, response: AgentResponse): void {
    const turn = this.activeTurn;
    if (!turn || turn.turnId !== turnId || turn.stage !== "generating") {
      this.staleResultsIgnored++;
      return;
    }

    const text = response.text.trim().slice(0, MESSAGE_MAX_LENGTH);
    if (!text) {
      this.failTurn(turn, "returned an empty response");
      return;
    }

    const persona = this.personas.get(turn.speakerId);
    const respondTo = turn.respondToMessageId
      ? this.state.messages.find((m) => m.id === turn.respondToMessageId)
      : undefined;
    const message: Message = {
      id: randomUUID(),
      kind: persona?.kind === "moderator" ? "moderator" : "agent",
      authorId: turn.speakerId,
      text,
      tone: "default",
      at: this.elapsedSeconds(),
      status: "streaming",
      ...(respondTo?.authorId && { replyToId: respondTo.authorId }),
    };

    this.makeRoomForMessage();
    turn.stage = "speaking";
    turn.message = message;
    this.emit("message.started", { turnId, message });

    // Holding the floor stands in for delivery time (and, later, audio).
    turn.speakingTimer = setTimeout(
      () => this.post(() => this.onSpoken(turnId)),
      this.timing.speakingMs(text)
    );
  }

  private onSpoken(turnId: string): void {
    const turn = this.activeTurn;
    if (!turn || turn.turnId !== turnId || turn.stage !== "speaking" || !turn.message) return;

    this.activeTurn = null;
    this.emit("message.completed", { turnId, message: { ...turn.message, status: "complete" } });
    this.emit("turn.ended", { turnId, speakerId: turn.speakerId, outcome: "completed" });
    this.advance();
  }

  private onGenerationFailed(turnId: string, error: unknown): void {
    const turn = this.activeTurn;
    if (!turn || turn.turnId !== turnId) {
      // Aborts of cancelled turns land here and are expected.
      if (!isAbortError(error)) this.staleResultsIgnored++;
      return;
    }
    this.failTurn(turn, isAbortError(error) ? "was cancelled" : "failed");
  }

  private failTurn(turn: ActiveTurn, reason: string): void {
    this.activeTurn = null;
    const name = this.personas.get(turn.speakerId)?.name ?? "A participant";
    this.emit("error", {
      turnId: turn.turnId,
      error: { code: "turn_failed", message: `${name} couldn't respond (${reason}).`, retryable: true },
    });
    this.emit("turn.ended", { turnId: turn.turnId, speakerId: turn.speakerId, outcome: "failed" });
    this.advance();
  }

  /** Ends the active turn early, keeping whatever was already delivered. */
  private cutOff(reason: "user_interrupt" | "user_message" | "room_ended"): void {
    const turn = this.cancelActiveTurn();
    if (!turn) return;

    if (turn.stage === "speaking" && turn.message) {
      this.emit("message.interrupted", {
        turnId: turn.turnId,
        messageId: turn.message.id,
        text: turn.message.text,
        reason,
      });
    }
    this.emit("turn.ended", { turnId: turn.turnId, speakerId: turn.speakerId, outcome: "aborted" });
  }

  /** Aborts generation and clears timers; any late result becomes stale. */
  private cancelActiveTurn(): ActiveTurn | null {
    const turn = this.activeTurn;
    if (!turn) return null;
    this.activeTurn = null;
    turn.abort.abort();
    if (turn.speakingTimer) clearTimeout(turn.speakingTimer);
    return turn;
  }

  /* ---------------------------------------------------------
     Speaker selection (deterministic for M1; the director arrives in 2A)
  --------------------------------------------------------- */

  private resolveSpeaker(request: TurnRequest): TurnRequest | null {
    if (request.intent !== "reaction") {
      return this.personas.has(request.speakerId) ? request : null;
    }

    // A reaction answers the most recent agent message, from someone else.
    const target = [...this.state.messages].reverse().find((m) => m.kind === "agent");
    if (!target?.authorId) return null;
    const reactor = this.leastHeard(target.authorId);
    return reactor ? { speakerId: reactor.id, intent: "reaction", respondToMessageId: target.id } : null;
  }

  /** The agent the user addressed by name or role, else the least-heard agent. */
  private pickResponder(text: string): Persona | undefined {
    const words = new Set(text.toLowerCase().match(/[a-z']+/g) ?? []);
    const agents = [...this.personas.values()].filter((p) => p.kind === "agent");
    const addressed = agents.find((agent) =>
      [agent.name.split(/\s+/)[0] ?? "", ...agent.role.split(/\s+/)]
        .map((w) => w.toLowerCase())
        .some((w) => w.length > 2 && words.has(w))
    );
    return addressed ?? this.leastHeard();
  }

  private leastHeard(excludeId?: string): Persona | undefined {
    const agents = [...this.personas.values()].filter((p) => p.kind === "agent" && p.id !== excludeId);
    // Stable: ties go to the earliest participant.
    return agents.reduce<Persona | undefined>((best, agent) => {
      if (!best) return agent;
      return (this.turnsBySpeaker.get(agent.id) ?? 0) < (this.turnsBySpeaker.get(best.id) ?? 0) ? agent : best;
    }, undefined);
  }

  /* ---------------------------------------------------------
     Internals
  --------------------------------------------------------- */

  /**
   * Called before a new message is added: trims the oldest messages so the
   * history never exceeds the cap, not even transiently. The active turn's
   * message and any streaming message are never trimmed. In-memory only —
   * trimmed messages are not recoverable (there is no persistence in M1).
   */
  private makeRoomForMessage(): void {
    const overflow = this.state.messages.length + 1 - this.maxMessages;
    if (overflow <= 0) return;

    const activeMessageId = this.activeTurn?.message?.id;
    const messageIds = this.state.messages
      .filter((m) => m.id !== activeMessageId && m.status !== "streaming")
      .slice(0, overflow)
      .map((m) => m.id);
    if (messageIds.length > 0) this.emit("messages.trimmed", { messageIds });
  }

  private buildContext(): TurnContext {
    return {
      decision: this.state.decision,
      roster: [...this.personas.values()].map(({ id, name, role, kind }) => ({ id, name, role, kind })),
      transcript: this.state.messages
        .filter((m) => m.kind !== "system")
        .slice(-TRANSCRIPT_WINDOW)
        .map((m) => ({ authorName: this.authorName(m), kind: m.kind, text: m.text })),
      turnNumber: this.turnCount,
    };
  }

  private authorName(message: Message): string {
    if (message.kind === "user") return "User";
    return (message.authorId && this.personas.get(message.authorId)?.name) || "System";
  }

  private elapsedSeconds(): number {
    const { startedAt } = this.state;
    return startedAt === null ? 0 : Math.max(0, Math.floor((this.now() - startedAt) / 1000));
  }

  private deny(operation: ActorOperation): OperationResult | null {
    if (isAllowed(operation, this.state.phase)) return null;
    return {
      ok: false,
      error: {
        code: "invalid_phase",
        message:
          this.state.phase === "ended"
            ? "This meeting has ended."
            : `That isn't possible while the room is in its ${this.state.phase} phase.`,
        retryable: false,
      },
    };
  }

  private transition(to: RoomPhase, extra: { startedAt?: number } = {}): void {
    if (!canTransition(this.state.phase, to)) return;
    this.emit("room.phase_changed", { phase: to, ...extra });
  }

  /** The single point of state change: build an event, fold it in, publish it. */
  private emit<T extends ServerEventType>(type: T, payload: ServerEventPayload<T>): void {
    const event = createEvent(type, payload, { roomId: this.roomId, seq: ++this.seq, ts: this.now() });
    this.state = applyEvent(this.state, event);
    this.options.onEvent(event);
  }

  /**
   * Serialises client-facing work. A disposed actor answers with "room
   * closed" instead of running it. Rejects only if `work` throws (a bug).
   */
  private enqueue(work: () => OperationResult): Promise<OperationResult> {
    const run = this.mailbox.then(() => (this.disposed ? CLOSED_RESULT : work()));
    this.mailbox = run.catch(() => undefined);
    return run;
  }

  /** Serialises internal completions; dropped once disposed, never rejects. */
  private post(work: () => void): void {
    const run = this.mailbox.then(() => {
      if (!this.disposed) work();
    });
    this.mailbox = run.catch((error: unknown) => this.options.onError?.(error));
  }

  private remember(clientMsgId: string, result: Promise<CommandAck>): void {
    this.commandResults.set(clientMsgId, result);
    if (this.commandResults.size > MAX_REMEMBERED_COMMANDS) {
      const oldest = this.commandResults.keys().next().value;
      if (oldest !== undefined) this.commandResults.delete(oldest);
    }
  }
}

const CLOSED_RESULT: OperationResult = {
  ok: false,
  error: { code: "room_not_found", message: "This room has closed.", retryable: false },
};

function toAck(clientMsgId: string, result: OperationResult): CommandAck {
  return result.ok
    ? { v: PROTOCOL_VERSION, clientMsgId, ok: true }
    : { v: PROTOCOL_VERSION, clientMsgId, ok: false, error: result.error };
}
