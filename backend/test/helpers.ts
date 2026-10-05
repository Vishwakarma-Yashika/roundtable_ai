import type { Persona, ServerEvent } from "@roundtable/shared";
import {
  LlmAbortError,
  type AgentResponse,
  type AgentResponseRequest,
  type LlmProvider,
} from "../src/llm/LlmProvider";
import { buildPersonas } from "../src/rooms/personas";
import { RoomActor, type RoomTiming } from "../src/rooms/RoomActor";

/** A provider whose responses the test resolves by hand. */
export class ControlledProvider implements LlmProvider {
  readonly name = "controlled";
  readonly calls: {
    request: AgentResponseRequest;
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  }[] = [];

  /** When false, the provider ignores abort signals (a misbehaving provider). */
  constructor(private readonly honourAbort = true) {}

  generateAgentResponse(request: AgentResponseRequest): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      this.calls.push({ request, resolve: (text) => resolve({ text }), reject });
      if (this.honourAbort) {
        request.signal.addEventListener("abort", () => reject(new LlmAbortError()), { once: true });
      }
    });
  }

  get last() {
    const call = this.calls.at(-1);
    if (!call) throw new Error("No provider calls yet");
    return call;
  }
}

export const PERSONAS: Persona[] = buildPersonas([
  { role: "Investor" },
  { role: "Devil's Advocate" },
  { role: "Technical Expert" },
]);

export function createActor(llm: LlmProvider, timing: Partial<RoomTiming> = {}, maxMessages?: number) {
  const events: ServerEvent[] = [];
  const actor = new RoomActor({
    roomId: "test-room",
    decision: "Should I build this startup?",
    personas: PERSONAS,
    llm,
    onEvent: (event) => events.push(event),
    timing: { speakingMs: () => 5, reactionsPerUserMessage: 0, ...timing },
    maxMessages,
  });
  return { actor, events };
}

export const types = (events: ServerEvent[]) => events.map((e) => e.type);

export async function waitFor(predicate: () => boolean, timeoutMs = 3000, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Lets queued microtasks and the actor mailbox drain. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let counter = 0;
export function command<T extends "user.message.send" | "user.interrupt" | "room.end">(
  type: T,
  payload: T extends "user.message.send" ? { text: string } : Record<string, never>,
  clientMsgId = `cmd-${String(++counter).padStart(8, "0")}`
) {
  return { v: 1 as const, type, clientMsgId, payload } as Extract<
    import("@roundtable/shared").ClientCommand,
    { type: T }
  >;
}
