import type { Persona } from "@roundtable/shared";
import {
  LlmAbortError,
  type AgentResponse,
  type AgentResponseRequest,
  type LlmProvider,
  type TurnContext,
  type TurnInstruction,
} from "./LlmProvider";

export interface FakeLlmProviderOptions {
  /** Latency multiplier: 2 is twice as fast. Tests use large values. */
  speed?: number;
  /** Base "thinking" latency before speed is applied. */
  baseDelayMs?: number;
}

/**
 * Deterministic, offline stand-in for a real model. The same persona,
 * turn number and preceding message always produce the same text and the
 * same latency, so tests are reproducible while conversations still vary.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name = "fake";
  private readonly speed: number;
  private readonly baseDelayMs: number;

  constructor(options: FakeLlmProviderOptions = {}) {
    this.speed = options.speed ?? 1;
    this.baseDelayMs = options.baseDelayMs ?? 900;
  }

  generateAgentResponse({ persona, context, instruction, signal }: AgentResponseRequest): Promise<AgentResponse> {
    const seed = hash(
      `${persona.id}|${context.turnNumber}|${instruction.intent}|${instruction.respondTo?.text ?? ""}`
    );
    const text = compose(persona, context, instruction, seed);
    const delayMs = (this.baseDelayMs + (seed % 700)) / this.speed;

    return new Promise<AgentResponse>((resolve, reject) => {
      if (signal.aborted) {
        reject(new LlmAbortError());
        return;
      }

      const onAbort = () => {
        clearTimeout(timer);
        reject(new LlmAbortError());
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve({
          text,
          usage: { inputTokens: estimateTokens(context), outputTokens: Math.ceil(text.length / 4) },
        });
      }, delayMs);

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

/* ---------------------------------------------------------
   Scripted content
--------------------------------------------------------- */

function compose(persona: Persona, context: TurnContext, instruction: TurnInstruction, seed: number): string {
  const focus = lowerFirst(persona.focus || persona.role);
  const goal = lowerFirst(persona.goal);
  const target = instruction.respondTo;
  const targetName = target ? firstName(target.authorName) : "";
  const quote = target ? snippet(target.text) : "";

  if (persona.kind === "moderator") {
    return pick(seed, moderatorLines(context, instruction));
  }

  switch (instruction.intent) {
    case "opening":
      return pick(seed, [
        `As the ${persona.role}, I'm coming at this through ${focus}. My starting position: ${stanceWord(persona.stance)} — and I'll need ${goal} before that changes.`,
        `I'll speak for ${focus}. On "${context.decision}", I'm ${stanceWord(persona.stance)} for now, because ${goal} is still unproven.`,
      ]);
    case "reply":
      return pick(seed, [
        `${quote ? `On "${quote}" — ` : ""}from where I sit, ${focus} decides this. I'd want ${goal} before committing.`,
        `${quote ? `You said "${quote}". ` : ""}That's fair, but it doesn't settle ${focus}. What evidence do we have?`,
        `Good question. As the ${persona.role}, I'd test the cheapest version first and judge it on ${goal}.`,
      ]);
    case "reaction":
      return pick(seed, [
        `I'd push back on ${targetName || "that"}. Once you factor in ${focus}, the picture changes.`,
        `${targetName ? `${targetName} is right` : "That's right"} up to a point — but it ignores ${focus}.`,
        `Building on ${targetName || "that point"}: the real question is still ${goal}.`,
      ]);
    default:
      return pick(seed, [
        `From the ${persona.role}'s side, I keep coming back to ${focus}.`,
        `Let's not lose sight of ${goal}.`,
      ]);
  }
}

function moderatorLines(context: TurnContext, instruction: TurnInstruction): string[] {
  if (instruction.intent === "opening") {
    return [
      `Welcome to the room. We're here to pressure-test one decision: "${context.decision}" Each perspective will open with where they stand, then it's an open floor.`,
    ];
  }
  return [
    "That's the room. You've heard where everyone stands — where would you like to start?",
    "Let's pause there. What's your read so far?",
  ];
}

function stanceWord(stance: number): string {
  if (stance >= 0.4) return "leaning for it";
  if (stance <= -0.4) return "leaning against it";
  return "undecided";
}

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

/** FNV-1a: tiny, fast and stable across runs and platforms. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick(seed: number, options: readonly string[]): string {
  return options[seed % options.length] ?? options[0] ?? "";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function lowerFirst(text: string): string {
  const trimmed = text.trim().replace(/[.!]+$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function snippet(text: string): string {
  const words = text.trim().replace(/[?.!]+$/, "").split(/\s+/);
  return words.length <= 8 ? words.join(" ") : `${words.slice(0, 8).join(" ")}…`;
}

function estimateTokens(context: TurnContext): number {
  const chars = context.decision.length + context.transcript.reduce((n, m) => n + m.text.length, 0);
  return Math.ceil(chars / 4);
}
