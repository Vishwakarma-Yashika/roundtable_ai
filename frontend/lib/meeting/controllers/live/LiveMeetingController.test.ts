/**
 * LiveMeetingController against the real room server (in-process, fake LLM).
 * Regression tests for audit finding C1: commands sent while the connection
 * is down must wait for the rejoin instead of being lost with `not_joined`.
 */
import type { AddressInfo } from "node:net";
import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../../../../backend/src/config/env";
import { FakeLlmProvider } from "../../../../../backend/src/llm/FakeLlmProvider";
import { buildServer, type RoomServerInstance } from "../../../../../backend/src/server";
import { LiveMeetingController } from "./LiveMeetingController";

let server: RoomServerInstance;
let serverUrl: string;
let roomId: string;
let controller: LiveMeetingController | null = null;
let socket: Socket | null = null;

beforeEach(async () => {
  server = await buildServer({
    env: loadEnv({ NODE_ENV: "test", PORT: "0" }),
    llm: new FakeLlmProvider({ speed: 20 }),
    timing: { speakingMs: () => 40, reactionsPerUserMessage: 0 },
    logger: false,
  });
  await server.app.listen({ port: 0, host: "127.0.0.1" });
  serverUrl = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;

  const created = await fetch(`${serverUrl}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "Should I build this startup?", perspectives: [{ role: "Investor" }] }),
  });
  roomId = ((await created.json()) as { roomId: string }).roomId;
  await fetch(`${serverUrl}/rooms/${roomId}/start`, { method: "POST" });
});

afterEach(async () => {
  controller?.stop();
  controller = null;
  socket = null;
  await server.app.close();
});

/** A controller whose underlying socket the test can sabotage. */
async function connectController(reconnectionDelay = 50) {
  controller = new LiveMeetingController({
    roomId,
    serverUrl,
    connect: (url) => {
      socket = io(url, { transports: ["websocket"], reconnectionDelay, reconnectionDelayMax: reconnectionDelay });
      return socket;
    },
  });
  controller.start();
  await waitFor(() => controller!.getSnapshot().connection === "live" && controller!.getSnapshot().seq > 0, "initial join");
  return controller;
}

/** Simulates a network blip: the transport dies and Socket.IO auto-reconnects. */
function dropConnection() {
  socket!.io.engine.close();
}

const userMessages = (texts: { kind: string; text: string }[], text: string) =>
  texts.filter((m) => m.kind === "user" && m.text === text).length;

const serverMessages = (text: string) => userMessages(server.registry.get(roomId)!.getState().messages, text);

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 4000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

describe("LiveMeetingController reconnect (C1)", () => {
  it("delivers a message sent while reconnecting, exactly once", async () => {
    const live = await connectController();

    // disconnect → user sends message → reconnect → join → delivered once
    dropConnection();
    await waitFor(() => live.getSnapshot().connection === "reconnecting", "disconnect noticed");
    live.sendMessage("sent during outage");

    await waitFor(() => userMessages(live.getSnapshot().messages, "sent during outage") > 0, "queued message delivered");
    expect(live.getSnapshot().connection).toBe("live");
    await settle();

    expect(userMessages(live.getSnapshot().messages, "sent during outage")).toBe(1);
    expect(serverMessages("sent during outage")).toBe(1);
    expect(live.getSnapshot().lastError?.code).not.toBe("not_joined");
  });

  it("re-sends a command whose acknowledgement was lost, without duplicating it", async () => {
    const live = await connectController();

    // Sent on a live connection that dies in the same tick: it may or may not
    // have reached the server, so it is re-sent after the rejoin with the
    // same clientMsgId and the server's duplicate protection decides.
    live.sendMessage("in flight during drop");
    dropConnection();

    await waitFor(() => userMessages(live.getSnapshot().messages, "in flight during drop") > 0, "delivered");
    await settle();
    expect(userMessages(live.getSnapshot().messages, "in flight during drop")).toBe(1);
    expect(serverMessages("in flight during drop")).toBe(1);
  });

  it("keeps several queued messages in their original order", async () => {
    const live = await connectController();
    dropConnection();
    await waitFor(() => live.getSnapshot().connection === "reconnecting", "disconnect noticed");
    live.sendMessage("first");
    live.sendMessage("second");
    live.sendMessage("third");

    await waitFor(() => userMessages(live.getSnapshot().messages, "third") === 1, "all delivered");
    const order = live
      .getSnapshot()
      .messages.filter((m) => m.kind === "user")
      .map((m) => m.text);
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("never delivers a message queued before stop()", async () => {
    // Slow reconnect so stop() happens while the message is still queued.
    const live = await connectController(400);
    dropConnection();
    await waitFor(() => live.getSnapshot().connection === "reconnecting", "disconnect noticed");
    live.sendMessage("must never arrive");

    live.stop();
    await settle(1200); // well past the reconnection delay

    expect(serverMessages("must never arrive")).toBe(0);
    expect(server.io.of("/").sockets.size).toBe(0); // no reconnect happened
    expect(socket!.connected).toBe(false);
  });

  it("drops queued commands and stops retrying when the room no longer exists", async () => {
    const live = await connectController();
    dropConnection();
    await waitFor(() => live.getSnapshot().connection === "reconnecting", "disconnect noticed");
    live.sendMessage("room is gone");

    server.registry.disposeAll(); // e.g. the server restarted and lost its rooms

    await waitFor(() => live.getSnapshot().connection === "offline", "room_not_found handled");
    expect(live.getSnapshot().lastError?.code).toBe("room_not_found");

    await settle(600);
    expect(server.io.of("/").sockets.size).toBe(0); // not retrying forever
    expect(userMessages(live.getSnapshot().messages, "room is gone")).toBe(0);

    // Further actions are rejected locally instead of queuing forever.
    live.sendMessage("after the room is gone");
    await settle(200);
    expect(server.io.of("/").sockets.size).toBe(0);
  });
});
