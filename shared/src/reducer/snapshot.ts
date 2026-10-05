import type { RoomState } from "../domain/room";
import type { ProtocolError } from "../protocol/errors";

/** Client-side connection state. Never sent by the server. */
export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Everything the Meeting Room UI renders: the server-authoritative room
 * state, plus the client's view of its own connection.
 */
export interface MeetingSnapshot extends RoomState {
  /** Highest event seq applied; 0 before the first event. */
  seq: number;
  connection: ConnectionState;
  lastError: ProtocolError | null;
}

export function createInitialSnapshot(
  roomId: string,
  overrides: Partial<Pick<MeetingSnapshot, "decision" | "connection">> = {}
): MeetingSnapshot {
  return {
    roomId,
    decision: overrides.decision ?? "",
    phase: "draft",
    participants: [],
    messages: [],
    activity: null,
    mode: "discussion",
    challengeAssumption: null,
    ended: false,
    startedAt: null,
    durationSeconds: 0,
    seq: 0,
    connection: overrides.connection ?? "connecting",
    lastError: null,
  };
}

/** Strips client-only fields: what a server sends in room.snapshot. */
export function toRoomState(snapshot: MeetingSnapshot): RoomState {
  const { seq: _seq, connection: _connection, lastError: _lastError, ...state } = snapshot;
  return state;
}
