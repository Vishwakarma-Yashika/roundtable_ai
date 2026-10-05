import type { MessageKind, Persona, TurnIntent } from "@roundtable/shared";

/**
 * Provider-independent contract for generating one participant's turn.
 * Nothing here is specific to any vendor: the fake provider implements it
 * today, and an Anthropic (or other) provider will implement it later
 * without RoomActor changing.
 */
export interface LlmProvider {
  readonly name: string;
  /**
   * Must reject promptly with an AbortError when `signal` aborts. Callers
   * also ignore late results on their own, so a provider that resolves
   * after an abort is harmless — just wasteful.
   */
  generateAgentResponse(request: AgentResponseRequest): Promise<AgentResponse>;
}

export interface AgentResponseRequest {
  persona: Persona;
  context: TurnContext;
  instruction: TurnInstruction;
  signal: AbortSignal;
}

export interface AgentResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/** What the speaker knows about the room when taking the floor. */
export interface TurnContext {
  decision: string;
  roster: { id: string; name: string; role: string; kind: Persona["kind"] }[];
  /** The most recent messages, oldest first. */
  transcript: TranscriptEntry[];
  /** 1-based count of turns taken so far in this room, including this one. */
  turnNumber: number;
}

export interface TranscriptEntry {
  authorName: string;
  kind: MessageKind;
  text: string;
}

/** Why the speaker has the floor, and what to respond to. */
export interface TurnInstruction {
  intent: TurnIntent;
  respondTo?: { authorName: string; text: string };
}

/** Thrown (or rejected with) when generation is cancelled. */
export class LlmAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Generation aborted");
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
