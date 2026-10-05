/**
 * Meeting Room types. Domain and snapshot types come from the shared
 * protocol package so the mock and live controllers (and the room server)
 * agree on one shape; frontend-only concerns are defined here.
 */
import type { MeetingSnapshot } from "@roundtable/shared";

export type {
  AccentKey,
  Activity,
  ConnectionState,
  MeetingSnapshot,
  Message,
  MessageKind,
  MessageStatus,
  MessageTone,
  Participant,
  ParticipantKind,
  ProtocolError,
  RoomMode,
  RoomPhase,
} from "@roundtable/shared";

/** How a participant appears in the sidebar; derived in the UI. */
export type ParticipantStatus =
  | "listening"
  | "thinking"
  | "speaking"
  | "challenging"
  | "left";

/** What the Room Setup screen hands to the Meeting Room. */
export interface RoomConfig {
  decision: string;
  perspectives: {
    role: string;
    icon: string;
    description: string;
  }[];
}

export interface NewPerspectiveInput {
  name: string;
  role: string;
  focus: string;
}

/** Room actions a controller supports; the UI disables the rest. */
export interface MeetingCapabilities {
  challenge: boolean;
  addPerspective: boolean;
}

/**
 * The boundary between the Meeting Room UI and whatever runs the meeting:
 * the local mock engine or the live room server. Components only ever see
 * this contract and the MeetingSnapshot it produces.
 *
 * Actions are fire-and-forget: results arrive as new snapshots.
 * `subscribe`, `getSnapshot` and `getElapsedSeconds` are passed around
 * detached, so implementations must bind them (e.g. arrow properties).
 */
export interface MeetingController {
  readonly capabilities: MeetingCapabilities;

  /** useSyncExternalStore-compatible subscription. */
  subscribe(listener: () => void): () => void;
  getSnapshot(): MeetingSnapshot;
  getElapsedSeconds(): number;

  /** Called when the room mounts. Must be safe to call again after stop(). */
  start(): void;
  /** Called when the room unmounts. Must cancel all pending async work. */
  stop(): void;

  /** Speak to the room. Implicitly interrupts whoever holds the floor. */
  sendMessage(text: string): void;
  /** Cut off the current speaker without saying anything. */
  interrupt(): void;
  challengeRoom(): void;
  addPerspective(input: NewPerspectiveInput): void;
  end(): void;
}
