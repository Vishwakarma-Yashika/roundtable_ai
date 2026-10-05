import { createEvent } from "../src/protocol/createEvent";
import type { ServerEventPayload, ServerEventType } from "../src/protocol/events";
import type { Message } from "../src/domain/message";
import type { Participant } from "../src/domain/participant";

export const ROOM_ID = "room-under-test";

/** Builds events with an auto-incrementing seq, like a real producer. */
export function eventFactory(roomId = ROOM_ID) {
  let seq = 0;
  return <T extends ServerEventType>(type: T, payload: ServerEventPayload<T>) =>
    createEvent(type, payload, { roomId, seq: ++seq, ts: 1_700_000_000_000 + seq });
}

export const maya: Participant = {
  id: "agent-investor",
  name: "Maya Chen",
  role: "Investor",
  icon: "💰",
  focus: "Opportunity, ROI and financial risk",
  accent: "emerald",
  kind: "agent",
};

export function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    kind: "agent",
    authorId: maya.id,
    text: "Let's put numbers on it.",
    tone: "default",
    at: 3,
    status: "streaming",
    ...overrides,
  };
}
