import type { RoomPhase } from "@roundtable/shared";

/**
 * Room lifecycle: DRAFT → OPENING → DEBATE → ENDED.
 * Pure rules; the RoomActor is the only thing that applies them.
 */
const TRANSITIONS: Record<RoomPhase, readonly RoomPhase[]> = {
  draft: ["opening", "ended"],
  opening: ["debate", "ended"],
  debate: ["ended"],
  ended: [],
};

export function canTransition(from: RoomPhase, to: RoomPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Phases in which each actor operation is allowed. */
export const ALLOWED_PHASES = {
  start: ["draft"],
  userMessage: ["opening", "debate"],
  interrupt: ["opening", "debate"],
  end: ["draft", "opening", "debate"],
} as const satisfies Record<string, readonly RoomPhase[]>;

export type ActorOperation = keyof typeof ALLOWED_PHASES;

export function isAllowed(operation: ActorOperation, phase: RoomPhase): boolean {
  return (ALLOWED_PHASES[operation] as readonly RoomPhase[]).includes(phase);
}

/** Phases in which participants may hold the floor. */
export function isLive(phase: RoomPhase): boolean {
  return phase === "opening" || phase === "debate";
}
