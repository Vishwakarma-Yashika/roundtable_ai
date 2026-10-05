import { z } from "zod";
import { IdSchema } from "../domain/ids";
import { MessageSchema } from "../domain/message";
import { ParticipantPatchSchema, ParticipantSchema } from "../domain/participant";
import { RoomPhaseSchema, RoomStateSchema, DECISION_MAX_LENGTH, MAX_ROOM_MESSAGES } from "../domain/room";
import { defineEvent } from "./envelope";
import { ProtocolErrorSchema } from "./errors";

/** Why a participant was given the floor. */
export const TurnIntentSchema = z.enum([
  "opening",
  "reply",
  "reaction",
  "moderation",
  "challenge",
  "welcome",
]);
export type TurnIntent = z.infer<typeof TurnIntentSchema>;

/* ---------------------------------------------------------
   Room
--------------------------------------------------------- */

/** Full authoritative state. Sent on join and reconnect. */
export const RoomSnapshotEventSchema = defineEvent(
  "room.snapshot",
  z.object({ state: RoomStateSchema })
);

export const RoomPhaseChangedEventSchema = defineEvent(
  "room.phase_changed",
  z.object({
    phase: RoomPhaseSchema,
    /** Present when the meeting clock starts. */
    startedAt: z.number().int().nonnegative().optional(),
  })
);

export const RoomEndedEventSchema = defineEvent(
  "room.ended",
  z.object({
    reason: z.enum(["user", "idle", "error", "server_shutdown"]),
    durationSeconds: z.number().int().nonnegative(),
  })
);

/* ---------------------------------------------------------
   Participants
--------------------------------------------------------- */

export const ParticipantJoinedEventSchema = defineEvent(
  "participant.joined",
  z.object({ participant: ParticipantSchema })
);

export const ParticipantUpdatedEventSchema = defineEvent(
  "participant.updated",
  z.object({ participantId: IdSchema, patch: ParticipantPatchSchema })
);

/* ---------------------------------------------------------
   Turns and messages
--------------------------------------------------------- */

/** A participant has the floor and is preparing a response ("thinking"). */
export const TurnStartedEventSchema = defineEvent(
  "turn.started",
  z.object({ turnId: IdSchema, speakerId: IdSchema, intent: TurnIntentSchema })
);

/** The speaker begins delivering a message (status "streaming"). */
export const MessageStartedEventSchema = defineEvent(
  "message.started",
  z.object({ turnId: IdSchema, message: MessageSchema })
);

/** A message is final. Also used for one-shot messages such as system notices. */
export const MessageCompletedEventSchema = defineEvent(
  "message.completed",
  z.object({ turnId: IdSchema.optional(), message: MessageSchema })
);

/** A message was cut off; `text` is what had been delivered. */
export const MessageInterruptedEventSchema = defineEvent(
  "message.interrupted",
  z.object({
    turnId: IdSchema,
    messageId: IdSchema,
    text: MessageSchema.shape.text,
    reason: z.enum(["user_interrupt", "user_message", "room_ended"]),
  })
);

export const TurnEndedEventSchema = defineEvent(
  "turn.ended",
  z.object({
    turnId: IdSchema,
    speakerId: IdSchema,
    outcome: z.enum(["completed", "aborted", "failed"]),
  })
);

/**
 * The server dropped these (oldest) messages to keep the room within
 * MAX_ROOM_MESSAGES. Clients remove them so every copy of the room agrees.
 */
export const MessagesTrimmedEventSchema = defineEvent(
  "messages.trimmed",
  z.object({ messageIds: z.array(IdSchema).min(1).max(MAX_ROOM_MESSAGES) })
);

/** The server accepted a user message; echoes the client's id for correlation. */
export const UserMessageAcceptedEventSchema = defineEvent(
  "user.message.accepted",
  z.object({ clientMsgId: z.string().min(1).max(64), message: MessageSchema })
);

/* ---------------------------------------------------------
   Challenge mode — produced only by the mock engine until Phase 2A,
   but part of the protocol because the existing UI contract uses it.
--------------------------------------------------------- */

export const ChallengeStartedEventSchema = defineEvent(
  "challenge.started",
  z.object({ assumption: z.string().max(DECISION_MAX_LENGTH) })
);

export const ChallengeEndedEventSchema = defineEvent("challenge.ended", z.object({}));

/* ---------------------------------------------------------
   Errors
--------------------------------------------------------- */

/** A room-level failure every client should know about (e.g. a turn failed). */
export const ErrorEventSchema = defineEvent(
  "error",
  z.object({ error: ProtocolErrorSchema, turnId: IdSchema.optional() })
);

/* ---------------------------------------------------------
   Union
--------------------------------------------------------- */

export const ServerEventSchema = z.discriminatedUnion("type", [
  RoomSnapshotEventSchema,
  RoomPhaseChangedEventSchema,
  RoomEndedEventSchema,
  ParticipantJoinedEventSchema,
  ParticipantUpdatedEventSchema,
  TurnStartedEventSchema,
  MessageStartedEventSchema,
  MessageCompletedEventSchema,
  MessageInterruptedEventSchema,
  MessagesTrimmedEventSchema,
  TurnEndedEventSchema,
  UserMessageAcceptedEventSchema,
  ChallengeStartedEventSchema,
  ChallengeEndedEventSchema,
  ErrorEventSchema,
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerEventType = ServerEvent["type"];
export type ServerEventOf<T extends ServerEventType> = Extract<ServerEvent, { type: T }>;
export type ServerEventPayload<T extends ServerEventType> = ServerEventOf<T>["payload"];
