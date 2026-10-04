export type AccentKey =
  | "violet"
  | "emerald"
  | "rose"
  | "sky"
  | "amber"
  | "fuchsia"
  | "cyan"
  | "lime"
  | "orange"
  | "indigo";

export type ParticipantKind = "agent" | "moderator";

export interface Participant {
  id: string;
  name: string;
  role: string;
  /** Emoji icon. Custom perspectives fall back to initials. */
  icon?: string;
  /** One-line description of what this perspective cares about. */
  focus: string;
  accent: AccentKey;
  kind: ParticipantKind;
  /** Lower-case keywords that make this participant likely to respond. */
  keywords: string[];
  /** Persona key into the mock line library; undefined for custom perspectives. */
  personaKey?: PersonaKey;
  isCustom?: boolean;
}

export type PersonaKey = "investor" | "devil" | "engineer" | "customer";

export type ParticipantStatus =
  | "listening"
  | "thinking"
  | "speaking"
  | "challenging"
  | "left";

export type MessageKind = "user" | "agent" | "moderator" | "system";

export type MessageTone = "default" | "challenge";

export interface Message {
  id: string;
  kind: MessageKind;
  /** Participant id; undefined for user and system messages. */
  authorId?: string;
  text: string;
  tone: MessageTone;
  /** Seconds since the meeting started. */
  at: number;
  /** Participant id this message is responding to. */
  replyToId?: string;
}

export type RoomMode = "discussion" | "challenge";

export interface Activity {
  participantId: string;
  phase: "thinking" | "speaking";
}

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

/** Everything the Meeting Room UI renders. Treated as immutable. */
export interface MeetingSnapshot {
  participants: Participant[];
  messages: Message[];
  activity: Activity | null;
  mode: RoomMode;
  /** The position being attacked while in challenge mode. */
  challengeAssumption: string | null;
  ended: boolean;
  /** Final duration in seconds, set when the meeting ends. */
  durationSeconds: number;
}

/**
 * The boundary between the Meeting Room UI and whatever runs the meeting.
 * Today that is the local mock engine; later a WebSocket/LLM-backed client
 * can implement the same contract without touching the components.
 *
 * Actions are fire-and-forget: results arrive as new snapshots.
 * `subscribe`, `getSnapshot` and `getElapsedSeconds` are passed around
 * detached, so implementations must bind them (e.g. arrow properties).
 */
export interface MeetingController {
  /** useSyncExternalStore-compatible subscription. */
  subscribe(listener: () => void): () => void;
  getSnapshot(): MeetingSnapshot;
  getElapsedSeconds(): number;

  /** Called when the room mounts. Must be safe to call again after stop(). */
  start(): void;
  /** Called when the room unmounts. Must cancel all pending async work. */
  stop(): void;

  sendMessage(text: string): void;
  challengeRoom(): void;
  addPerspective(input: NewPerspectiveInput): void;
  end(): void;
}
