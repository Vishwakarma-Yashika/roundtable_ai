"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MeetingEngine } from "@/lib/meeting/engine";
import type { MeetingController, RoomConfig } from "@/lib/meeting/types";

export type MeetingControllerFactory = (config: RoomConfig) => MeetingController;

/** Today's implementation: a local simulation using mock data. */
const createMockMeeting: MeetingControllerFactory = (config) => new MeetingEngine(config);

/**
 * Creates one meeting controller for the lifetime of the component and
 * subscribes to its state. Remount (e.g. with a new `key`) for a new meeting.
 *
 * Components only see the MeetingController contract, so a real
 * backend client can be swapped in through `createController`.
 */
export function useMeetingEngine(
  config: RoomConfig,
  createController: MeetingControllerFactory = createMockMeeting
) {
  const [controller] = useState(() => createController(config));

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  return { controller, ...snapshot };
}
