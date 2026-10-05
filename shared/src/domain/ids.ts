import { z } from "zod";

/** Ids for participants, messages and turns. */
export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

/**
 * Room ids are unguessable: 128 random bits, base64url-encoded (22 chars).
 * Knowing a room id is currently the only access control (no auth in M1).
 */
export const RoomIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{22}$/, "Invalid room id");

export type RoomId = z.infer<typeof RoomIdSchema>;
