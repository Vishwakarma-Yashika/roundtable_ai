import { describe, expect, it } from "vitest";
import { FakeLlmProvider } from "../src/llm/FakeLlmProvider";
import { isAbortError, type AgentResponseRequest } from "../src/llm/LlmProvider";
import { PERSONAS } from "./helpers";

const investor = PERSONAS.find((p) => p.role === "Investor")!;
const devil = PERSONAS.find((p) => p.role === "Devil's Advocate")!;

function request(overrides: Partial<AgentResponseRequest> = {}): AgentResponseRequest {
  return {
    persona: investor,
    context: { decision: "Should I build this startup?", roster: [], transcript: [], turnNumber: 3 },
    instruction: { intent: "reply", respondTo: { authorName: "User", text: "What would it cost to test this?" } },
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("FakeLlmProvider", () => {
  const fast = new FakeLlmProvider({ speed: 1000 });

  it("returns the same response for the same input", async () => {
    const a = await fast.generateAgentResponse(request());
    const b = await fast.generateAgentResponse(request());
    expect(a.text).toBe(b.text);
    expect(a.text.length).toBeGreaterThan(20);
  });

  it("varies by participant and turn", async () => {
    const base = await fast.generateAgentResponse(request());
    const otherPersona = await fast.generateAgentResponse(request({ persona: devil }));
    const outputs = new Set<string>([base.text, otherPersona.text]);
    for (let turnNumber = 4; turnNumber < 10; turnNumber++) {
      const r = await fast.generateAgentResponse(
        request({ context: { ...request().context, turnNumber } })
      );
      outputs.add(r.text);
    }
    expect(outputs.size).toBeGreaterThan(2);
  });

  it("responds to the message it was given", async () => {
    const response = await fast.generateAgentResponse(
      request({ instruction: { intent: "reaction", respondTo: { authorName: "Rhys Okafor", text: "No." } } })
    );
    expect(response.text).toMatch(/Rhys|that/);
  });

  it("adds artificial latency", async () => {
    const slow = new FakeLlmProvider({ speed: 10 }); // (900..1600ms) / 10 = 90..160ms
    const started = Date.now();
    await slow.generateAgentResponse(request());
    expect(Date.now() - started).toBeGreaterThanOrEqual(80);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await new FakeLlmProvider().generateAgentResponse(request({ signal: controller.signal })).catch((e: unknown) => e);
    expect(isAbortError(error)).toBe(true);
  });

  it("rejects promptly when aborted mid-generation", async () => {
    const controller = new AbortController();
    const provider = new FakeLlmProvider(); // ~1s latency
    const started = Date.now();
    const pending = provider.generateAgentResponse(request({ signal: controller.signal }));
    setTimeout(() => controller.abort(), 20);
    const error = await pending.catch((e: unknown) => e);
    expect(isAbortError(error)).toBe(true);
    expect(Date.now() - started).toBeLessThan(400);
  });
});
