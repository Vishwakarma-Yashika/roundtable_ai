import type { MeetingController, RoomConfig } from "@/lib/meeting/types";
import { LiveMeetingController } from "./live/LiveMeetingController";
import { MockMeetingController } from "./mock/MockMeetingController";

/** Explicit choice of meeting backend, made by the route that hosts the room. */
export type MeetingControllerOptions =
  | { kind: "mock"; config: RoomConfig }
  | { kind: "live"; roomId: string; serverUrl: string };

/** The one place that knows which MeetingController implementations exist. */
export function createMeetingController(options: MeetingControllerOptions): MeetingController {
  switch (options.kind) {
    case "mock":
      return new MockMeetingController(options.config);
    case "live":
      return new LiveMeetingController({ roomId: options.roomId, serverUrl: options.serverUrl });
  }
}
