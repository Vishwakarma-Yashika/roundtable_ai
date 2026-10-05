import type { AccentKey, CreateRoomRequest, Persona } from "@roundtable/shared";

/**
 * Builds the room's personas from the perspectives chosen on Room Setup.
 * Known roles get a named built-in persona; anything else becomes a custom
 * persona. Phase 2A replaces this with LLM-generated perspectives.
 */
const BUILTIN: Record<string, Omit<Persona, "id" | "kind">> = {
  Investor: {
    name: "Maya Chen",
    role: "Investor",
    icon: "💰",
    accent: "emerald",
    focus: "Opportunity, ROI and financial risk",
    goal: "Evidence that someone will pay",
    temperament: "skeptical, numbers-first",
    stance: -0.2,
  },
  "Devil's Advocate": {
    name: "Rhys Okafor",
    role: "Devil's Advocate",
    icon: "⚔️",
    accent: "rose",
    focus: "Challenging assumptions and finding weak points",
    goal: "A reason this will work, not just a reason it could",
    temperament: "blunt, contrarian",
    stance: -0.6,
  },
  "Technical Expert": {
    name: "Dev Patel",
    role: "Technical Expert",
    icon: "💻",
    accent: "sky",
    focus: "Feasibility, complexity and scalability",
    goal: "A prototype that proves the hard part",
    temperament: "pragmatic, optimistic about building",
    stance: 0.5,
  },
  Customer: {
    name: "Sam Rivera",
    role: "Customer",
    icon: "👤",
    accent: "amber",
    focus: "Real user needs and experience",
    goal: "Proof it saves real people time",
    temperament: "plain-spoken, impatient with jargon",
    stance: 0.1,
  },
};

const CUSTOM_ACCENTS: AccentKey[] = ["fuchsia", "cyan", "lime", "orange", "indigo", "sky", "amber"];

export const MODERATOR_PERSONA: Persona = {
  id: "moderator",
  name: "Ada",
  role: "Moderator",
  icon: "◉",
  accent: "violet",
  kind: "moderator",
  focus: "Keeps the discussion balanced and moving",
  goal: "A balanced hearing for every perspective",
  temperament: "calm, neutral",
  stance: 0,
};

export function buildPersonas(perspectives: CreateRoomRequest["perspectives"]): Persona[] {
  const seen = new Set<string>();
  const agents: Persona[] = [];
  let customIndex = 0;

  for (const perspective of perspectives) {
    const key = perspective.role.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const builtin = BUILTIN[perspective.role];
    const id = `agent-${agents.length + 1}`;

    if (builtin) {
      agents.push({ ...builtin, id, kind: "agent" });
    } else {
      const accent = CUSTOM_ACCENTS[customIndex++ % CUSTOM_ACCENTS.length] ?? "indigo";
      agents.push({
        id,
        kind: "agent",
        name: perspective.role,
        role: perspective.role,
        accent,
        focus: perspective.description || perspective.role,
        goal: `Clarity on ${perspective.role.toLowerCase()} concerns`,
        temperament: "thoughtful",
        stance: 0,
        isCustom: true,
        ...(perspective.icon ? { icon: perspective.icon } : {}),
      });
    }
  }

  return [MODERATOR_PERSONA, ...agents];
}
