import { z } from "zod";

export const ProtocolErrorCodeSchema = z.enum([
  "invalid_command",
  "unsupported_version",
  "room_not_found",
  "not_joined",
  "invalid_phase",
  "room_limit_reached",
  "turn_failed",
  "internal_error",
]);
export type ProtocolErrorCode = z.infer<typeof ProtocolErrorCodeSchema>;

export const ProtocolErrorSchema = z.object({
  code: ProtocolErrorCodeSchema,
  /** Human-readable and safe to display; never contains internals. */
  message: z.string().max(300),
  /** Whether retrying the same request may succeed. */
  retryable: z.boolean(),
});
export type ProtocolError = z.infer<typeof ProtocolErrorSchema>;
