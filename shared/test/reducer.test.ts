import { describe, expect, it } from "vitest";
import { applyEvent, applyEvents } from "../src/reducer/applyEvent";
import { createInitialSnapshot, toRoomState } from "../src/reducer/snapshot";
import { createEvent } from "../src/protocol/createEvent";
import { eventFactory, maya, message, ROOM_ID } from "./fixtures";

const initial = () => createInitialSnapshot(ROOM_ID, { decision: "Should I build this startup?" });

describe("applyEvent", () => {
  it("adds participants and applies updates", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("participant.joined", { participant: maya }),
      ev("participant.updated", { participantId: maya.id, patch: { focus: "Unit economics" } }),
    ]);
    expect(s.participants).toHaveLength(1);
    expect(s.participants[0]?.focus).toBe("Unit economics");
    expect(s.participants[0]?.name).toBe("Maya Chen");
  });

  it("tracks phase changes and the meeting clock", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("room.phase_changed", { phase: "opening", startedAt: 1000 }),
      ev("room.phase_changed", { phase: "debate" }),
    ]);
    expect(s.phase).toBe("debate");
    expect(s.startedAt).toBe(1000);
    expect(s.ended).toBe(false);
  });

  it("moves a turn from thinking to speaking when its message starts", () => {
    const ev = eventFactory();
    const thinking = applyEvent(
      initial(),
      ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "opening" })
    );
    expect(thinking.activity).toEqual({ participantId: maya.id, phase: "thinking", turnId: "t1" });

    const speaking = applyEvent(thinking, ev("message.started", { turnId: "t1", message: message() }));
    expect(speaking.activity?.phase).toBe("speaking");
    expect(speaking.messages).toEqual([message()]);
  });

  it("completes a message in place", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "reply" }),
      ev("message.started", { turnId: "t1", message: message() }),
      ev("message.completed", { turnId: "t1", message: message({ status: "complete" }) }),
      ev("turn.ended", { turnId: "t1", speakerId: maya.id, outcome: "completed" }),
    ]);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]?.status).toBe("complete");
    expect(s.activity).toBeNull();
  });

  it("marks interrupted messages and keeps the delivered text", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "reply" }),
      ev("message.started", { turnId: "t1", message: message() }),
      ev("message.interrupted", {
        turnId: "t1",
        messageId: "msg-1",
        text: "Let's put",
        reason: "user_interrupt",
      }),
      ev("turn.ended", { turnId: "t1", speakerId: maya.id, outcome: "aborted" }),
    ]);
    expect(s.messages[0]).toMatchObject({ text: "Let's put", status: "interrupted" });
    expect(s.activity).toBeNull();
  });

  it("only clears activity for the turn that ended", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("turn.started", { turnId: "t2", speakerId: maya.id, intent: "reply" }),
      ev("turn.ended", { turnId: "t1-stale", speakerId: maya.id, outcome: "aborted" }),
    ]);
    expect(s.activity?.turnId).toBe("t2");
  });

  it("removes trimmed messages and keeps the rest in order", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("message.completed", { message: message({ id: "m1", status: "complete" }) }),
      ev("message.completed", { message: message({ id: "m2", status: "complete" }) }),
      ev("message.completed", { message: message({ id: "m3", status: "complete" }) }),
      ev("messages.trimmed", { messageIds: ["m1", "m2", "unknown-id"] }),
    ]);
    expect(s.messages.map((m) => m.id)).toEqual(["m3"]);
  });

  it("adds accepted user messages", () => {
    const ev = eventFactory();
    const user = message({ id: "msg-u", kind: "user", authorId: undefined, status: "complete" });
    const s = applyEvent(initial(), ev("user.message.accepted", { clientMsgId: "c-12345678", message: user }));
    expect(s.messages).toEqual([user]);
  });

  it("ends the room and clears transient state", () => {
    const ev = eventFactory();
    const s = applyEvents(initial(), [
      ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "reply" }),
      ev("challenge.started", { assumption: "Demand is real" }),
      ev("room.ended", { reason: "user", durationSeconds: 95 }),
    ]);
    expect(s).toMatchObject({
      phase: "ended",
      ended: true,
      durationSeconds: 95,
      activity: null,
      mode: "discussion",
      challengeAssumption: null,
    });
  });

  it("toggles challenge mode", () => {
    const ev = eventFactory();
    const started = applyEvent(initial(), ev("challenge.started", { assumption: "Demand is real" }));
    expect(started).toMatchObject({ mode: "challenge", challengeAssumption: "Demand is real" });
    const ended = applyEvent(started, ev("challenge.ended", {}));
    expect(ended).toMatchObject({ mode: "discussion", challengeAssumption: null });
  });

  it("records room-level errors", () => {
    const ev = eventFactory();
    const error = { code: "turn_failed" as const, message: "Maya couldn't respond.", retryable: true };
    expect(applyEvent(initial(), ev("error", { error })).lastError).toEqual(error);
  });

  it("ignores duplicate and out-of-order events", () => {
    const ev = eventFactory();
    const first = ev("participant.joined", { participant: maya });
    const second = ev("participant.updated", { participantId: maya.id, patch: { name: "Maya" } });
    const s = applyEvents(initial(), [first, second, first, second]);
    expect(s.seq).toBe(2);
    expect(s.participants).toHaveLength(1);
    expect(s.participants[0]?.name).toBe("Maya");
  });

  it("ignores events for another room", () => {
    const other = eventFactory("another-room");
    const s = applyEvent(initial(), other("participant.joined", { participant: maya }));
    expect(s).toEqual(initial());
  });

  it("replaces server state on snapshot but keeps client connection state", () => {
    const ev = eventFactory();
    const before = { ...applyEvent(initial(), ev("participant.joined", { participant: maya })), connection: "reconnecting" as const };
    const serverState = { ...toRoomState(before), phase: "debate" as const, messages: [message()] };
    const after = applyEvent(
      before,
      createEvent("room.snapshot", { state: serverState }, { roomId: ROOM_ID, seq: 40, ts: 0 })
    );
    expect(after.phase).toBe("debate");
    expect(after.messages).toHaveLength(1);
    expect(after.seq).toBe(40);
    expect(after.connection).toBe("reconnecting");
  });

  it("never mutates its input", () => {
    const ev = eventFactory();
    const s0 = initial();
    const frozen = JSON.stringify(s0);
    applyEvents(s0, [
      ev("participant.joined", { participant: maya }),
      ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "opening" }),
      ev("message.started", { turnId: "t1", message: message() }),
    ]);
    expect(JSON.stringify(s0)).toBe(frozen);
  });
});
