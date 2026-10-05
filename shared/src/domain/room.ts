import { z } from "zod";
import { IdSchema } from "./ids";
import { MessageSchema } from "./message";
import { ParticipantSchema } from "./participant";

/** Lifecycle phases. Later phases (challenge, synthesis, verdict) arrive in 2A. */
export const RoomPhaseSchema = z.enum(["draft", "opening", "debate", "ended"]);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

export const RoomModeSchema = z.enum(["discussion", "challenge"]);
export type RoomMode = z.infer<typeof RoomModeSchema>;

/** Who currently holds the floor, and whether they are preparing or delivering. */
export const ActivitySchema = z.object({
  participantId: IdSchema,
  phase: z.enum(["thinking", "speaking"]),
  turnId: IdSchema,
});
export type Activity = z.infer<typeof ActivitySchema>;

export const DECISION_MAX_LENGTH = 500;
export const MAX_PARTICIPANTS = 16;
/**
 * Upper bound on a room's in-memory message history. The room server trims
 * the oldest messages (announcing it with messages.trimmed) so a room's
 * state always satisfies this schema. Not persistence: trimmed messages are gone.
 */
export const MAX_ROOM_MESSAGES = 2000;

/** Everything the server is authoritative for. Sent whole in room.snapshot. */
export const RoomStateSchema = z.object({
  roomId: z.string().min(1).max(64),
  decision: z.string().max(DECISION_MAX_LENGTH),
  phase: RoomPhaseSchema,
  participants: z.array(ParticipantSchema).max(MAX_PARTICIPANTS),
  messages: z.array(MessageSchema).max(MAX_ROOM_MESSAGES),
  activity: ActivitySchema.nullable(),
  mode: RoomModeSchema,
  /** The position being attacked while in challenge mode. */
  challengeAssumption: z.string().max(DECISION_MAX_LENGTH).nullable(),
  ended: z.boolean(),
  /** Epoch ms when the meeting started; null while in draft. */
  startedAt: z.number().int().nonnegative().nullable(),
  /** Final duration in seconds, set when the meeting ends. */
  durationSeconds: z.number().int().nonnegative(),
});
export type RoomState = z.infer<typeof RoomStateSchema>;
