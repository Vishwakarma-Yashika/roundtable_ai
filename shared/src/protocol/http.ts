import { z } from "zod";
import { RoomIdSchema } from "../domain/ids";
import { DECISION_MAX_LENGTH, RoomPhaseSchema, RoomStateSchema } from "../domain/room";
import { ProtocolErrorSchema } from "./errors";

export const MAX_SETUP_PERSPECTIVES = 8;

/** POST /rooms — the decision and the perspectives chosen on Room Setup. */
export const CreateRoomRequestSchema = z.object({
  decision: z.string().trim().min(1).max(DECISION_MAX_LENGTH),
  perspectives: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(60),
        icon: z.string().max(16).optional(),
        description: z.string().trim().max(240).optional(),
      })
    )
    .min(1)
    .max(MAX_SETUP_PERSPECTIVES),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const CreateRoomResponseSchema = z.object({
  roomId: RoomIdSchema,
  state: RoomStateSchema,
});
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

/** POST /rooms/:roomId/start */
export const StartRoomResponseSchema = z.object({
  roomId: RoomIdSchema,
  phase: RoomPhaseSchema,
});
export type StartRoomResponse = z.infer<typeof StartRoomResponseSchema>;

export const ApiErrorResponseSchema = z.object({ error: ProtocolErrorSchema });
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
