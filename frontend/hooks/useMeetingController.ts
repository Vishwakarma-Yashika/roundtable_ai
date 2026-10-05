"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createMeetingController,
  type MeetingControllerOptions,
} from "@/lib/meeting/controllers/createMeetingController";

/**
 * Creates one meeting controller for the lifetime of the component and
 * subscribes to its state. Remount (e.g. with a new `key`) for a new meeting.
 *
 * Components only see the MeetingController contract and its snapshot,
 * never which implementation (mock or live) is behind it.
 */
export function useMeetingController(options: MeetingControllerOptions) {
  const [controller] = useState(() => createMeetingController(options));

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  return { controller, snapshot };
}
