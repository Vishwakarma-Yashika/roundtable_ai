import type { Message } from "../domain/message";
import type { Participant } from "../domain/participant";
import type { ServerEvent } from "../protocol/events";
import type { MeetingSnapshot } from "./snapshot";

/**
 * The single place where server events become UI state, used by both the
 * mock and the live controller (and by the server to maintain its own
 * state). Pure: no timers, I/O or platform APIs, and inputs are never
 * mutated.
 *
 * Events for another room, or at/below the last applied seq, are ignored,
 * so replays and duplicate deliveries are harmless.
 */
export function applyEvent(snapshot: MeetingSnapshot, event: ServerEvent): MeetingSnapshot {
  if (event.roomId !== snapshot.roomId) return snapshot;

  // A snapshot replaces everything the server owns, including the seq.
  if (event.type === "room.snapshot") {
    if (event.seq < snapshot.seq) return snapshot;
    return {
      ...event.payload.state,
      seq: event.seq,
      connection: snapshot.connection,
      lastError: snapshot.lastError,
    };
  }

  if (event.seq <= snapshot.seq) return snapshot;
  return { ...reduce(snapshot, event), seq: event.seq };
}

export function applyEvents(snapshot: MeetingSnapshot, events: readonly ServerEvent[]): MeetingSnapshot {
  return events.reduce(applyEvent, snapshot);
}

function reduce(s: MeetingSnapshot, event: Exclude<ServerEvent, { type: "room.snapshot" }>): MeetingSnapshot {
  switch (event.type) {
    case "room.phase_changed": {
      const { phase, startedAt } = event.payload;
      const ended = s.ended || phase === "ended";
      return {
        ...s,
        phase,
        ended,
        startedAt: startedAt ?? s.startedAt,
        activity: ended ? null : s.activity,
      };
    }

    case "room.ended":
      return {
        ...s,
        phase: "ended",
        ended: true,
        durationSeconds: event.payload.durationSeconds,
        activity: null,
        mode: "discussion",
        challengeAssumption: null,
      };

    case "participant.joined":
      return { ...s, participants: upsertById(s.participants, event.payload.participant) };

    case "participant.updated": {
      const { participantId, patch } = event.payload;
      return {
        ...s,
        participants: s.participants.map((p) => (p.id === participantId ? { ...p, ...patch } : p)),
      };
    }

    case "turn.started": {
      const { turnId, speakerId } = event.payload;
      return { ...s, activity: { participantId: speakerId, phase: "thinking", turnId } };
    }

    case "message.started": {
      const { turnId, message } = event.payload;
      return {
        ...s,
        messages: upsertById(s.messages, message),
        activity:
          s.activity?.turnId === turnId ? { ...s.activity, phase: "speaking" } : s.activity,
      };
    }

    case "message.completed":
      return { ...s, messages: upsertById(s.messages, event.payload.message) };

    case "message.interrupted": {
      const { messageId, text } = event.payload;
      return {
        ...s,
        messages: s.messages.map((m): Message =>
          m.id === messageId ? { ...m, text, status: "interrupted" } : m
        ),
      };
    }

    case "messages.trimmed": {
      const trimmed = new Set(event.payload.messageIds);
      return { ...s, messages: s.messages.filter((m) => !trimmed.has(m.id)) };
    }

    case "turn.ended":
      return {
        ...s,
        activity: s.activity?.turnId === event.payload.turnId ? null : s.activity,
      };

    case "user.message.accepted":
      return { ...s, messages: upsertById(s.messages, event.payload.message) };

    case "challenge.started":
      return { ...s, mode: "challenge", challengeAssumption: event.payload.assumption };

    case "challenge.ended":
      return { ...s, mode: "discussion", challengeAssumption: null };

    case "error":
      return { ...s, lastError: event.payload.error };

    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

/** Replaces the item with the same id, or appends it. */
function upsertById<T extends Participant | Message>(items: readonly T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  const next = [...items];
  next[index] = item;
  return next;
}
