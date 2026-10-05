import type { ServerEventOf, ServerEventPayload, ServerEventType } from "./events";
import { PROTOCOL_VERSION } from "./version";

/**
 * Builds a typed server event. Pure: the caller supplies seq and time,
 * so producers own their clocks and counters.
 */
export function createEvent<T extends ServerEventType>(
  type: T,
  payload: ServerEventPayload<T>,
  meta: { roomId: string; seq: number; ts: number }
): ServerEventOf<T> {
  return { v: PROTOCOL_VERSION, ...meta, type, payload } as ServerEventOf<T>;
}
