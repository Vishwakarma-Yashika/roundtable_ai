import {
  ApiErrorResponseSchema,
  CreateRoomResponseSchema,
  StartRoomResponseSchema,
  type CreateRoomRequest,
} from "@roundtable/shared";
import type { z } from "zod";
import { meetingConfig } from "./config";
import { saveRoomConfig } from "./room-config";
import type { RoomConfig } from "./types";

/**
 * Creates the room chosen on Room Setup and returns the path to open.
 * Mock: stores the config locally for /room. Live: creates and starts the
 * room on the room server, then opens /room/[roomId].
 */
export async function launchRoom(config: RoomConfig): Promise<string> {
  if (meetingConfig.backend === "mock") {
    saveRoomConfig(config);
    return "/room";
  }

  const request: CreateRoomRequest = {
    decision: config.decision,
    perspectives: config.perspectives.map(({ role, icon, description }) => ({
      role,
      icon,
      description,
    })),
  };

  const { roomId } = await postJson("/rooms", request, CreateRoomResponseSchema);
  await postJson(`/rooms/${encodeURIComponent(roomId)}/start`, undefined, StartRoomResponseSchema);
  return `/room/${encodeURIComponent(roomId)}`;
}

async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${meetingConfig.roomServerUrl}${path}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the room server. Is it running?");
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = ApiErrorResponseSchema.safeParse(json);
    throw new Error(apiError.success ? apiError.data.error.message : "The room server rejected the request.");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error("The room server sent an unexpected response.");
  return parsed.data;
}
