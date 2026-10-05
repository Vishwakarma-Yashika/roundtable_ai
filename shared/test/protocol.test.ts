import { describe, expect, it } from "vitest";
import { ClientCommandSchema, CommandAckSchema } from "../src/protocol/commands";
import { ServerEventSchema } from "../src/protocol/events";
import { CreateRoomRequestSchema } from "../src/protocol/http";
import { PROTOCOL_VERSION } from "../src/protocol/version";
import { eventFactory, maya, message } from "./fixtures";

const ROOM_ID_22 = "AbCdEfGhIjKlMnOpQrStUv";

describe("server events", () => {
  it("parses every well-formed event", () => {
    const ev = eventFactory();
    const events = [
      ev("participant.joined", { participant: maya }),
      ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "opening" }),
      ev("message.started", { turnId: "t1", message: message() }),
      ev("message.completed", { message: message({ status: "complete" }) }),
      ev("message.interrupted", { turnId: "t1", messageId: "msg-1", text: "Let's", reason: "user_message" }),
      ev("turn.ended", { turnId: "t1", speakerId: maya.id, outcome: "aborted" }),
      ev("room.phase_changed", { phase: "debate" }),
      ev("room.ended", { reason: "user", durationSeconds: 12 }),
      ev("messages.trimmed", { messageIds: ["msg-1", "msg-2"] }),
      ev("error", { error: { code: "turn_failed", message: "Oops", retryable: true } }),
    ];
    for (const event of events) {
      expect(ServerEventSchema.safeParse(event).success, event.type).toBe(true);
    }
  });

  it("bounds messages.trimmed", () => {
    const ev = eventFactory();
    expect(ServerEventSchema.safeParse(ev("messages.trimmed", { messageIds: [] })).success).toBe(false);
    const tooMany = Array.from({ length: 2001 }, (_, i) => `m-${i}`);
    expect(ServerEventSchema.safeParse(ev("messages.trimmed", { messageIds: tooMany })).success).toBe(false);
  });

  it("rejects a wrong protocol version", () => {
    const ev = eventFactory();
    const event = { ...ev("room.phase_changed", { phase: "debate" }), v: 2 };
    expect(ServerEventSchema.safeParse(event).success).toBe(false);
  });

  it("rejects an unknown event type", () => {
    const event = { v: PROTOCOL_VERSION, roomId: "r", seq: 1, ts: 0, type: "agent.hacked", payload: {} };
    expect(ServerEventSchema.safeParse(event).success).toBe(false);
  });

  it("rejects a payload that doesn't match its type", () => {
    const ev = eventFactory();
    const event = { ...ev("turn.started", { turnId: "t1", speakerId: maya.id, intent: "opening" }), payload: { turnId: "t1" } };
    expect(ServerEventSchema.safeParse(event).success).toBe(false);
  });

  it("rejects non-positive or fractional seq", () => {
    const ev = eventFactory();
    const base = ev("room.phase_changed", { phase: "debate" });
    expect(ServerEventSchema.safeParse({ ...base, seq: 0 }).success).toBe(false);
    expect(ServerEventSchema.safeParse({ ...base, seq: 1.5 }).success).toBe(false);
  });

  it("rejects malformed ids and over-long text", () => {
    const ev = eventFactory();
    const badId = ev("participant.joined", { participant: { ...maya, id: "<script>" } });
    const longText = ev("message.completed", { message: message({ text: "x".repeat(5000) }) });
    expect(ServerEventSchema.safeParse(badId).success).toBe(false);
    expect(ServerEventSchema.safeParse(longText).success).toBe(false);
  });
});

describe("client commands", () => {
  const base = { v: PROTOCOL_VERSION, clientMsgId: "cmd-00000001" };

  it("parses valid commands", () => {
    const commands = [
      { ...base, type: "room.join", payload: { roomId: ROOM_ID_22, lastSeq: 0 } },
      { ...base, type: "user.message.send", payload: { text: "What about cost?" } },
      { ...base, type: "user.interrupt", payload: {} },
      { ...base, type: "room.end", payload: {} },
    ];
    for (const command of commands) {
      expect(ClientCommandSchema.safeParse(command).success, command.type).toBe(true);
    }
  });

  it("trims user text and rejects empty or oversized messages", () => {
    const parse = (text: string) =>
      ClientCommandSchema.safeParse({ ...base, type: "user.message.send", payload: { text } });
    const ok = parse("  hello  ");
    expect(ok.success && ok.data.type === "user.message.send" && ok.data.payload.text).toBe("hello");
    expect(parse("   ").success).toBe(false);
    expect(parse("x".repeat(2001)).success).toBe(false);
  });

  it("rejects guessable or malformed room ids", () => {
    const join = (roomId: string) =>
      ClientCommandSchema.safeParse({ ...base, type: "room.join", payload: { roomId, lastSeq: 0 } });
    expect(join("1").success).toBe(false);
    expect(join("../../etc/passwd-aaaaaaa").success).toBe(false);
  });

  it("rejects missing or invalid clientMsgId", () => {
    expect(ClientCommandSchema.safeParse({ v: 1, type: "room.end", payload: {} }).success).toBe(false);
    expect(
      ClientCommandSchema.safeParse({ ...base, clientMsgId: "short", type: "room.end", payload: {} }).success
    ).toBe(false);
  });

  it("rejects unknown commands", () => {
    expect(ClientCommandSchema.safeParse({ ...base, type: "room.delete", payload: {} }).success).toBe(false);
  });

  it("validates acknowledgements", () => {
    expect(CommandAckSchema.safeParse({ ...base, ok: true }).success).toBe(true);
    expect(CommandAckSchema.safeParse({ ...base, ok: false }).success).toBe(false);
  });
});

describe("http", () => {
  it("validates room creation input", () => {
    const valid = { decision: " Should I build this? ", perspectives: [{ role: "Investor" }] };
    const parsed = CreateRoomRequestSchema.safeParse(valid);
    expect(parsed.success && parsed.data.decision).toBe("Should I build this?");
    expect(CreateRoomRequestSchema.safeParse({ decision: "", perspectives: [{ role: "x" }] }).success).toBe(false);
    expect(CreateRoomRequestSchema.safeParse({ decision: "ok", perspectives: [] }).success).toBe(false);
    expect(
      CreateRoomRequestSchema.safeParse({
        decision: "ok",
        perspectives: Array.from({ length: 9 }, () => ({ role: "x" })),
      }).success
    ).toBe(false);
  });
});
