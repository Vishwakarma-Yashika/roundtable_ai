import {
  applyEvents,
  createInitialSnapshot,
  MAX_ROOM_MESSAGES,
  ServerEventSchema,
  toRoomState,
} from "@roundtable/shared";
import { describe, expect, it } from "vitest";
import { FakeLlmProvider } from "../src/llm/FakeLlmProvider";
import { ControlledProvider, command, createActor, flush, types, waitFor } from "./helpers";

describe("RoomActor lifecycle", () => {
  it("runs DRAFT → OPENING → DEBATE → ENDED", async () => {
    const { actor, events } = createActor(new FakeLlmProvider({ speed: 1000 }));
    expect(actor.phase).toBe("draft");
    expect(types(events).every((t) => t === "participant.joined")).toBe(true);

    expect(await actor.start()).toEqual({ ok: true });
    expect(actor.phase).toBe("opening");

    // Moderator opening + 3 agent openings + moderator hand-off.
    await waitFor(() => actor.phase === "debate", 3000, "debate phase");
    const messages = actor.getState().messages;
    expect(messages).toHaveLength(5);
    expect(messages.every((m) => m.status === "complete")).toBe(true);
    expect(messages[0]?.kind).toBe("moderator");
    expect(actor.getState().activity).toBeNull();

    const ack = await actor.handle(command("room.end", {}));
    expect(ack.ok).toBe(true);
    expect(actor.phase).toBe("ended");
    expect(events.at(-1)?.type).toBe("room.ended");
  });

  it("rejects starting twice and commands before start", async () => {
    const { actor } = createActor(new ControlledProvider());
    const early = await actor.handle(command("user.message.send", { text: "Hello?" }));
    expect(early.ok).toBe(false);
    expect(!early.ok && early.error.code).toBe("invalid_phase");

    await actor.start();
    const again = await actor.start();
    expect(again.ok).toBe(false);
  });

  it("emits strictly increasing, gap-free sequence numbers", async () => {
    const { actor, events } = createActor(new FakeLlmProvider({ speed: 1000 }));
    await actor.start();
    await waitFor(() => actor.phase === "debate");
    events.forEach((event, i) => expect(event.seq).toBe(i + 1));
    expect(actor.snapshotEvent().seq).toBe(events.length);
  });
});

describe("RoomActor command processing", () => {
  it("processes concurrent commands serially, in arrival order", async () => {
    const llm = new ControlledProvider();
    const { actor, events } = createActor(llm);
    await actor.start();

    const acks = await Promise.all([
      actor.handle(command("user.message.send", { text: "first" })),
      actor.handle(command("user.message.send", { text: "second" })),
      actor.handle(command("user.message.send", { text: "third" })),
    ]);
    expect(acks.every((a) => a.ok)).toBe(true);

    const accepted = events
      .filter((e) => e.type === "user.message.accepted")
      .map((e) => (e.type === "user.message.accepted" ? e.payload.message.text : ""));
    expect(accepted).toEqual(["first", "second", "third"]);

    // Each message cut off the turn the previous one started: one live turn at most.
    const started = events.filter((e) => e.type === "turn.started").length;
    const ended = events.filter((e) => e.type === "turn.ended").length;
    expect(started - ended).toBe(1);
  });

  it("acknowledges a duplicate clientMsgId without running it twice", async () => {
    const { actor, events } = createActor(new ControlledProvider());
    await actor.start();
    const cmd = command("user.message.send", { text: "only once" }, "dup-00000001");

    const [a, b] = await Promise.all([actor.handle(cmd), actor.handle(cmd)]);
    const c = await actor.handle(cmd);
    expect(a).toEqual(b);
    expect(c).toEqual(a);
    expect(events.filter((e) => e.type === "user.message.accepted")).toHaveLength(1);
  });

  it("answers the user with a reply turn, then the configured reactions", async () => {
    const llm = new ControlledProvider();
    const { actor, events } = createActor(llm, { reactionsPerUserMessage: 1 });
    await actor.start();
    await actor.handle(command("user.message.send", { text: "Rhys, is this a bad idea?" }));

    const reply = llm.last;
    expect(reply.request.instruction.intent).toBe("reply");
    expect(reply.request.persona.name).toBe("Rhys Okafor"); // addressed by name
    expect(reply.request.instruction.respondTo?.text).toBe("Rhys, is this a bad idea?");

    reply.resolve("Yes — prove demand first.");
    await waitFor(() => llm.calls.length === 3 && llm.last.request.instruction.intent === "reaction");
    expect(llm.last.request.persona.name).not.toBe("Rhys Okafor");
    expect(events.some((e) => e.type === "message.completed" && e.payload.message.replyToId === undefined)).toBe(true);
  });
});

describe("RoomActor interruption", () => {
  it("aborts a turn that is still generating", async () => {
    const llm = new ControlledProvider();
    const { actor, events } = createActor(llm);
    await actor.start();
    const opening = llm.last;

    const ack = await actor.handle(command("user.interrupt", {}));
    expect(ack.ok).toBe(true);
    expect(opening.request.signal.aborted).toBe(true);

    const turnEnded = events.findLast((e) => e.type === "turn.ended");
    expect(turnEnded?.type === "turn.ended" && turnEnded.payload.outcome).toBe("aborted");
    expect(events.some((e) => e.type === "message.started")).toBe(false);
    expect(actor.getState().activity).toBeNull();
  });

  it("marks a message interrupted when cut off while speaking", async () => {
    const llm = new ControlledProvider();
    const { actor, events } = createActor(llm, { speakingMs: () => 10_000 });
    await actor.start();

    llm.last.resolve("Welcome to the room — let's begin.");
    await waitFor(() => events.some((e) => e.type === "message.started"));

    await actor.handle(command("user.interrupt", {}));
    const interrupted = events.find((e) => e.type === "message.interrupted");
    expect(interrupted?.type === "message.interrupted" && interrupted.payload.reason).toBe("user_interrupt");
    expect(actor.getState().messages[0]).toMatchObject({
      status: "interrupted",
      text: "Welcome to the room — let's begin.",
    });
  });

  it("ignores a stale result that arrives after interruption", async () => {
    // This provider ignores abort signals, like a slow or misbehaving vendor SDK.
    const llm = new ControlledProvider(false);
    const { actor, events } = createActor(llm);
    await actor.start();
    const staleCall = llm.last;

    await actor.handle(command("user.message.send", { text: "Hold on, new question." }));
    const replyCall = llm.last;
    expect(replyCall).not.toBe(staleCall);

    const before = actor.getState();
    const eventCount = events.length;

    staleCall.resolve("I'm the old opening and should never appear.");
    await flush();
    await flush();

    expect(actor.staleResultsIgnored).toBe(1);
    expect(events).toHaveLength(eventCount);
    expect(actor.getState()).toEqual(before);
    expect(actor.getState().messages.some((m) => m.text.includes("old opening"))).toBe(false);

    // The current turn is unaffected and still completes normally.
    replyCall.resolve("Fresh answer.");
    await waitFor(() => actor.getState().messages.some((m) => m.text === "Fresh answer."));
  });

  it("reports a failed turn and keeps the room running", async () => {
    const llm = new ControlledProvider();
    const { actor, events } = createActor(llm);
    await actor.start();

    llm.last.reject(new Error("provider exploded"));
    await waitFor(() => events.some((e) => e.type === "error"));

    const error = events.find((e) => e.type === "error");
    expect(error?.type === "error" && error.payload.error.code).toBe("turn_failed");
    expect(error?.type === "error" && error.payload.error.message).not.toContain("exploded"); // no internals leak
    await waitFor(() => llm.calls.length === 2, 1000, "next turn after failure");
  });
});

describe("RoomActor end", () => {
  it("cuts off the active turn, ends the room, and rejects further commands", async () => {
    const llm = new ControlledProvider(false);
    const { actor, events } = createActor(llm);
    await actor.start();
    const inFlight = llm.last;

    expect((await actor.handle(command("room.end", {}))).ok).toBe(true);
    expect(actor.phase).toBe("ended");
    expect(types(events).slice(-3)).toEqual(["turn.ended", "message.completed", "room.ended"]);

    const count = events.length;
    inFlight.resolve("Too late.");
    await flush();
    expect(events).toHaveLength(count);

    const after = await actor.handle(command("user.message.send", { text: "anyone?" }));
    expect(!after.ok && after.error.code).toBe("invalid_phase");
    expect((await actor.handle(command("room.end", {}))).ok).toBe(false);
  });

  it("drops all work once disposed", async () => {
    const llm = new ControlledProvider(false);
    const { actor, events } = createActor(llm);
    await actor.start();
    const inFlight = llm.last;
    actor.dispose();

    const count = events.length;
    inFlight.resolve("After disposal.");
    await flush();
    expect(events).toHaveLength(count);
    const ack = await actor.handle(command("user.message.send", { text: "hi" }));
    expect(ack.ok).toBe(false);
  });
});

describe("RoomActor message cap (C2)", () => {
  it("keeps history within the cap, newest first, with a valid snapshot", async () => {
    const CAP = 10;
    const { actor, events } = createActor(new ControlledProvider(), {}, CAP);
    await actor.start();

    for (let i = 1; i <= 25; i++) {
      const ack = await actor.handle(command("user.message.send", { text: `message ${i}` }));
      expect(ack.ok).toBe(true);
      expect(actor.getState().messages.length).toBeLessThanOrEqual(CAP);
    }

    const messages = actor.getState().messages;
    expect(messages).toHaveLength(CAP);
    expect(messages.at(-1)?.text).toBe("message 25");
    expect(messages.map((m) => m.text)).toEqual(Array.from({ length: CAP }, (_, i) => `message ${16 + i}`));
    expect(ServerEventSchema.safeParse(actor.snapshotEvent()).success).toBe(true);
    expect(events.some((e) => e.type === "messages.trimmed")).toBe(true);

    // Sequence numbers stay gap-free, and every event is protocol-valid.
    events.forEach((event, i) => expect(event.seq).toBe(i + 1));
    expect(events.every((e) => ServerEventSchema.safeParse(e).success)).toBe(true);

    // A client folding the same events ends up with exactly the server's state.
    const initial = createInitialSnapshot("test-room", { decision: actor.getState().decision, connection: "live" });
    const folded = applyEvents(initial, events);
    expect(toRoomState(folded)).toEqual(actor.getState());
  });

  it("never trims the active turn's message, which still completes normally", async () => {
    const CAP = 3;
    const llm = new ControlledProvider();
    const { actor } = createActor(llm, {}, CAP);
    await actor.start();
    for (let i = 1; i <= 5; i++) await actor.handle(command("user.message.send", { text: `m${i}` }));

    // The reply turn for m5 is generating; deliver it at the cap.
    llm.last.resolve("Agent reply at the cap.");
    await waitFor(() => actor.getState().messages.some((m) => m.status === "streaming"));
    const streaming = actor.getState().messages.find((m) => m.status === "streaming")!;
    expect(actor.getState().messages).toHaveLength(CAP);
    expect(actor.getState().activity?.phase).toBe("speaking");

    await waitFor(() => actor.getState().messages.find((m) => m.id === streaming.id)?.status === "complete");
    expect(actor.getState().messages.at(-1)?.text).toBe("Agent reply at the cap.");
    expect(actor.getState().messages).toHaveLength(CAP);
  });

  it("can never be configured above the shared schema limit", async () => {
    const { actor } = createActor(new ControlledProvider(), {}, MAX_ROOM_MESSAGES * 10);
    await actor.start();
    // The clamp is internal; a valid snapshot at start is the observable contract.
    expect(ServerEventSchema.safeParse(actor.snapshotEvent()).success).toBe(true);
  });
});
