import { z } from "zod";
import { IdSchema } from "./ids";

export const MessageKindSchema = z.enum(["user", "agent", "moderator", "system"]);
export type MessageKind = z.infer<typeof MessageKindSchema>;

export const MessageToneSchema = z.enum(["default", "challenge"]);
export type MessageTone = z.infer<typeof MessageToneSchema>;

/**
 * - streaming: the author holds the floor and the message may still change
 * - complete: final
 * - interrupted: cut off; `text` is what was delivered before the cut
 */
export const MessageStatusSchema = z.enum(["streaming", "complete", "interrupted"]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MESSAGE_MAX_LENGTH = 4000;
export const USER_MESSAGE_MAX_LENGTH = 2000;

export const MessageSchema = z.object({
  id: IdSchema,
  kind: MessageKindSchema,
  /** Participant id; absent for user and system messages. */
  authorId: IdSchema.optional(),
  text: z.string().max(MESSAGE_MAX_LENGTH),
  tone: MessageToneSchema,
  /** Seconds since the meeting started. */
  at: z.number().int().nonnegative(),
  /** Participant id this message responds to. */
  replyToId: IdSchema.optional(),
  status: MessageStatusSchema,
});
export type Message = z.infer<typeof MessageSchema>;
