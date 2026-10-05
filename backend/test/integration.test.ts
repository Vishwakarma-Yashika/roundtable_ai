import {
  applyEvent,
  createInitialSnapshot,
  MAX_ROOM_MESSAGES,
  PROTOCOL_VERSION,
  ServerEventSchema,
  toRoomState,
  type ClientCommand,
  type CommandAck,
  type MeetingSnapshot,
  type ServerEvent,
} from "@roundtable/shared";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env";
import { FakeLlmProvider } from "../src/llm/FakeLlmProvider";
import { buildServer, type RoomServerInstance } from "../src/server";
import { waitFor } from "./helpers";

let server: RoomServerInstance;
let baseUrl: string;

beforeAll(async () => {
  server = await buildServer({
    env: loadEnv({ PORT: "0", CORS_ORIGIN: "http://localhost:3000" }),
    llm: new FakeLlmProvider({ speed: 20 }), // ~45–80ms per turn
    timing: { speakingMs: () => 60, reactionsPerUserMessage: 1 },
    logger: false,
  });
  await server.app.listen({ port: 0, host: "127.0.0.1" });
  baseUrl = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server.app.close();
});

/** A protocol client that folds events through the shared reducer, like the browser. */
class TestClient {
  readonly socket: Socket;
  readonly events: ServerEvent[] = [];
  snapshot: MeetingSnapshot;
  invalidEvents = 0;
  private counter = 0;

  constructor(roomId: string) {
    this.snapshot = createInitialSnapshot(roomId);
    this.socket = connect(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
    this.socket.on("event", (raw: unknown) => {
      const parsed = ServerEventSchema.safeParse(raw);
      if (!parsed.success) {
        this.invalidEvents++;
        return;
      }
      this.events.push(parsed.data);
      this.snapshot = applyEvent(this.snapshot, parsed.data);
    });
  }

  connected() {
    return new Promise<void>((resolve) => this.socket.once("connect", () => resolve()));
  }

  send(type: ClientCommand["type"], payload: object, clientMsgId = `it-${++this.counter}-${Date.now()}`): Promise<CommandAck> {
    return this.socket
      .timeout(3000)
      .emitWithAck("command", { v: PROTOCOL_VERSION, type, clientMsgId, payload }) as Promise<CommandAck>;
  }

  raw(payload: unknown): Promise<CommandAck> {
    return this.socket.timeout(3000).emitWithAck("command", payload) as Promise<CommandAck>;
  }

  has(predicate: (e: ServerEvent) => boolean) {
    return this.events.some(predicate);
  }

  close() {
    this.socket.disconnect();
  }
}

async function post(path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function createRoom() {
  const { status, json } = await post("/rooms", {
    decision: "Should I build this startup?",
    perspectives: [{ role: "Investor" }, { role: "Devil's Advocate" }, { role: "Customer" }],
  });
  expect(status).toBe(201);
  return json.roomId as string;
}

describe("room server end-to-end", () => {
  it("connect → join → start → messages → interrupt → reconnect → snapshot → end", async () => {
    const roomId = await createRoom();
    expect(roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);

    // Connect and join before starting.
    const client = new TestClient(roomId);
    await client.connected();
    expect((await client.send("room.join", { roomId, lastSeq: 0 })).ok).toBe(true);
    expect(client.events[0]?.type).toBe("room.snapshot");
    expect(client.snapshot.participants).toHaveLength(4);
    expect(client.snapshot.phase).toBe("draft");

    // Start: opening statements stream in as events.
    const started = await post(`/rooms/${roomId}/start`);
    expect(started.status).toBe(200);
    await waitFor(() => client.snapshot.phase === "debate", 5000, "opening round");
    expect(client.snapshot.messages.filter((m) => m.status === "complete").length).toBe(5);

    // Ask a question, then interrupt the reply while it's in progress.
    expect((await client.send("user.message.send", { text: "What would it cost to validate?" })).ok).toBe(true);
    await waitFor(() => client.snapshot.activity !== null, 2000, "reply turn");
    const interruptedTurn = client.snapshot.activity!.turnId;
    expect((await client.send("user.interrupt", {})).ok).toBe(true);
    await waitFor(
      () => client.has((e) => e.type === "turn.ended" && e.payload.turnId === interruptedTurn && e.payload.outcome === "aborted"),
      2000,
      "aborted turn"
    );
    expect(client.snapshot.activity).toBeNull();

    // Nothing from the interrupted turn arrives later.
    const countAfterInterrupt = client.events.length;
    await new Promise((r) => setTimeout(r, 300));
    expect(client.events.length).toBe(countAfterInterrupt);

    // Reconnect as a fresh connection: the snapshot matches what we folded.
    const lastSeq = client.snapshot.seq;
    const before = toRoomState(client.snapshot);
    client.close();

    const rejoined = new TestClient(roomId);
    await rejoined.connected();
    expect((await rejoined.send("room.join", { roomId, lastSeq })).ok).toBe(true);
    expect(rejoined.events[0]?.type).toBe("room.snapshot");
    expect(toRoomState(rejoined.snapshot)).toEqual(before);
    expect(rejoined.snapshot.seq).toBe(lastSeq);

    // The rejoined client keeps receiving live events, and can end the room.
    expect((await rejoined.send("room.end", {})).ok).toBe(true);
    await waitFor(() => rejoined.snapshot.ended, 2000, "room.ended");
    expect(rejoined.snapshot.phase).toBe("ended");
    expect(rejoined.snapshot.messages.at(-1)?.text).toBe("Meeting ended");
    expect(rejoined.invalidEvents + client.invalidEvents).toBe(0);

    rejoined.close();
  });

  it("broadcasts identical state to every client in the room", async () => {
    const roomId = await createRoom();
    const a = new TestClient(roomId);
    const b = new TestClient(roomId);
    await Promise.all([a.connected(), b.connected()]);
    await a.send("room.join", { roomId, lastSeq: 0 });
    await b.send("room.join", { roomId, lastSeq: 0 });

    await post(`/rooms/${roomId}/start`);
    await waitFor(() => a.snapshot.phase === "debate" && b.snapshot.phase === "debate", 5000);
    await b.send("room.end", {});
    await waitFor(() => a.snapshot.ended && b.snapshot.ended, 2000);

    expect(toRoomState(a.snapshot)).toEqual(toRoomState(b.snapshot));
    expect(a.snapshot.seq).toBe(b.snapshot.seq);
    a.close();
    b.close();
  });

  it("rejects invalid, unjoined, duplicate and unknown-room commands", async () => {
    const roomId = await createRoom();
    const client = new TestClient(roomId);
    await client.connected();

    const garbage = await client.raw({ hello: "world" });
    expect(!garbage.ok && garbage.error.code).toBe("invalid_command");

    const wrongVersion = await client.raw({ v: 99, type: "room.end", clientMsgId: "abcdefgh1", payload: {} });
    expect(!wrongVersion.ok && wrongVersion.error.code).toBe("unsupported_version");

    const notJoined = await client.send("user.message.send", { text: "hi" });
    expect(!notJoined.ok && notJoined.error.code).toBe("not_joined");

    const missing = await client.send("room.join", { roomId: "AAAAAAAAAAAAAAAAAAAAAA", lastSeq: 0 });
    expect(!missing.ok && missing.error.code).toBe("room_not_found");

    await client.send("room.join", { roomId, lastSeq: 0 });
    await post(`/rooms/${roomId}/start`);
    const [first, retry] = await Promise.all([
      client.send("user.message.send", { text: "once" }, "retry-0000001"),
      client.send("user.message.send", { text: "once" }, "retry-0000001"),
    ]);
    expect(first).toEqual(retry);
    await waitFor(() => client.has((e) => e.type === "user.message.accepted"), 1000);
    expect(client.snapshot.messages.filter((m) => m.kind === "user")).toHaveLength(1);
    client.close();
  });

  it("stays joinable past the message cap, with identical client and server state (C2)", async () => {
    const roomId = await createRoom();
    const watcher = new TestClient(roomId);
    await watcher.connected();
    await watcher.send("room.join", { roomId, lastSeq: 0 });
    await post(`/rooms/${roomId}/start`);

    const actor = server.registry.get(roomId)!;
    const total = MAX_ROOM_MESSAGES + 50;
    for (let i = 1; i <= total; i++) {
      const ack = await actor.handle({
        v: PROTOCOL_VERSION,
        type: "user.message.send",
        clientMsgId: `cap-${String(i).padStart(6, "0")}`,
        payload: { text: `cap message ${i}` },
      });
      expect(ack.ok).toBe(true);
    }
    await waitFor(() => watcher.snapshot.messages.some((m) => m.text === `cap message ${total}`), 10000, "last message");

    const state = actor.getState();
    expect(state.messages.length).toBeLessThanOrEqual(MAX_ROOM_MESSAGES);
    expect(state.messages.some((m) => m.text === `cap message ${total}`)).toBe(true);
    expect(state.messages.some((m) => m.text === "cap message 1")).toBe(false);

    // A reconnecting client accepts the snapshot and matches the live watcher.
    const rejoined = new TestClient(roomId);
    await rejoined.connected();
    expect((await rejoined.send("room.join", { roomId, lastSeq: 0 })).ok).toBe(true);
    expect(rejoined.events[0]?.type).toBe("room.snapshot");
    expect(rejoined.invalidEvents + watcher.invalidEvents).toBe(0);
    await waitFor(() => toRoomState(watcher.snapshot).messages.length === toRoomState(rejoined.snapshot).messages.length, 3000);
    expect(toRoomState(rejoined.snapshot).messages).toEqual(toRoomState(watcher.snapshot).messages);

    // The room is still usable.
    expect((await rejoined.send("user.message.send", { text: "still works" })).ok).toBe(true);
    await waitFor(() => rejoined.snapshot.messages.some((m) => m.text === "still works"), 2000);
    expect(rejoined.snapshot.messages.length).toBeLessThanOrEqual(MAX_ROOM_MESSAGES);

    watcher.close();
    rejoined.close();
  }, 60_000);

  it("validates REST input and room ids", async () => {
    expect((await post("/rooms", { decision: "" })).status).toBe(400);
    expect((await post("/rooms", { decision: "x", perspectives: [] })).status).toBe(400);
    expect((await post("/rooms/not-a-room/start")).status).toBe(404);
    expect((await post("/rooms/AAAAAAAAAAAAAAAAAAAAAA/start")).status).toBe(404);
  });
});
