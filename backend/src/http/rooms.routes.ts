import {
  CreateRoomRequestSchema,
  RoomIdSchema,
  type ApiErrorResponse,
  type CreateRoomResponse,
  type ProtocolError,
  type StartRoomResponse,
} from "@roundtable/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { RoomLimitError, type RoomRegistry } from "../rooms/RoomRegistry";

/** REST surface for creating and starting rooms. All input is Zod-validated. */
export function registerRoomRoutes(app: FastifyInstance, registry: RoomRegistry): void {
  app.get("/health", async () => ({ ok: true, rooms: registry.size }));

  app.post("/rooms", async (request, reply) => {
    const parsed = CreateRoomRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, {
        code: "invalid_command",
        message: "The room request is invalid.",
        retryable: false,
      });
    }

    try {
      const actor = registry.create(parsed.data);
      const body: CreateRoomResponse = { roomId: actor.roomId, state: actor.getState() };
      return reply.code(201).send(body);
    } catch (error) {
      if (error instanceof RoomLimitError) {
        return sendError(reply, 503, {
          code: "room_limit_reached",
          message: "The room server is at capacity. Please try again shortly.",
          retryable: true,
        });
      }
      throw error;
    }
  });

  app.post("/rooms/:roomId/start", async (request, reply) => {
    const roomId = RoomIdSchema.safeParse((request.params as { roomId?: unknown }).roomId);
    const actor = roomId.success ? registry.get(roomId.data) : undefined;
    if (!actor) {
      return sendError(reply, 404, { code: "room_not_found", message: "Room not found.", retryable: false });
    }

    const result = await actor.start();
    if (!result.ok) return sendError(reply, 409, result.error);

    const body: StartRoomResponse = { roomId: actor.roomId, phase: actor.phase };
    return reply.send(body);
  });
}

function sendError(reply: FastifyReply, status: number, error: ProtocolError) {
  const body: ApiErrorResponse = { error };
  return reply.code(status).send(body);
}
