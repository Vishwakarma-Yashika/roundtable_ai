/**
 * Public, build-time meeting configuration. This is the only module that
 * reads these environment variables; nothing here may be secret, because
 * NEXT_PUBLIC_* values are inlined into the browser bundle.
 */
export type MeetingBackend = "mock" | "live";

export const meetingConfig = {
  /** Which backend Room Setup launches. Defaults to the local mock. */
  backend: (process.env.NEXT_PUBLIC_MEETING_BACKEND === "live" ? "live" : "mock") as MeetingBackend,
  /** Base URL of the room server (REST + Socket.IO) for live rooms. */
  roomServerUrl: process.env.NEXT_PUBLIC_ROOM_SERVER_URL || "http://localhost:4000",
} as const;
