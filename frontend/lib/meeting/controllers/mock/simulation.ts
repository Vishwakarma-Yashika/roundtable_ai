import { CUSTOM_ACCENT_ORDER } from "@/lib/meeting/accents";
import type { AccentKey, NewPerspectiveInput, RoomConfig } from "@/lib/meeting/types";
import {
  MODERATOR,
  PERSONAS,
  TOPIC_KEYWORDS,
  type Persona,
  type Topic,
} from "./personas";
import type { MockParticipant } from "./types";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

let idCounter = 0;

export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Picks a line that hasn't been used yet in this meeting, if possible. */
export function pickFresh(pool: readonly string[], used: Set<string>): string {
  const fresh = pool.filter((line) => !used.has(line));
  const line = randomItem(fresh.length > 0 ? fresh : pool);
  used.add(line);
  return line;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function lowerFirst(text: string): string {
  const trimmed = text.trim().replace(/[.!]+$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function personaFor(participant: MockParticipant): Persona | undefined {
  return participant.personaKey ? PERSONAS[participant.personaKey] : undefined;
}

/* ---------------------------------------------------------
   Building the room
--------------------------------------------------------- */

export function buildParticipants(config: RoomConfig): MockParticipant[] {
  const moderator: MockParticipant = {
    id: MODERATOR.id,
    name: MODERATOR.name,
    role: MODERATOR.role,
    icon: MODERATOR.icon,
    focus: MODERATOR.focus,
    accent: MODERATOR.accent,
    kind: "moderator",
    keywords: MODERATOR.keywords,
  };

  const usedAccents: AccentKey[] = [MODERATOR.accent];

  const agents = config.perspectives.map((perspective): MockParticipant => {
    const persona = Object.values(PERSONAS).find((p) =>
      p.roles.includes(perspective.role)
    );

    if (persona) {
      usedAccents.push(persona.accent);
      return {
        id: `agent-${persona.key}`,
        name: persona.name,
        role: persona.role,
        icon: persona.icon,
        focus: perspective.description || persona.focus,
        accent: persona.accent,
        kind: "agent",
        keywords: [...persona.keywords, firstName(persona.name).toLowerCase()],
        personaKey: persona.key,
      };
    }

    const custom = createCustomParticipant(
      {
        name: perspective.role,
        role: perspective.role,
        focus: perspective.description,
      },
      usedAccents
    );
    usedAccents.push(custom.accent);
    return { ...custom, icon: perspective.icon };
  });

  return [moderator, ...agents];
}

export function createCustomParticipant(
  input: NewPerspectiveInput,
  usedAccents: AccentKey[]
): MockParticipant {
  const accent =
    CUSTOM_ACCENT_ORDER.find((key) => !usedAccents.includes(key)) ??
    randomItem(CUSTOM_ACCENT_ORDER);

  const keywords = [
    ...tokenize(input.name),
    ...tokenize(input.role).filter((word) => word.length > 3),
  ];

  return {
    id: createId("agent"),
    name: input.name.trim(),
    role: input.role.trim(),
    focus: input.focus.trim(),
    accent,
    kind: "agent",
    keywords,
    isCustom: true,
  };
}

/* ---------------------------------------------------------
   Choosing who speaks
--------------------------------------------------------- */

export function detectTopic(text: string): Topic {
  const words = tokenize(text);
  let best: Topic = "general";
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = words.filter((word) => keywords.includes(word)).length;
    if (score > bestScore) {
      best = topic as Topic;
      bestScore = score;
    }
  }

  return best;
}

/** Returns the agent explicitly named in the text, if any. */
export function findAddressed(
  text: string,
  participants: MockParticipant[]
): MockParticipant | undefined {
  const words = new Set(tokenize(text));
  return participants.find(
    (p) => p.kind === "agent" && p.keywords.some((k) => words.has(k))
  );
}

export function pickResponder(
  text: string,
  participants: MockParticipant[],
  recentSpeakerIds: string[]
): MockParticipant | undefined {
  const agents = participants.filter((p) => p.kind === "agent");
  if (agents.length === 0) return undefined;

  const addressed = findAddressed(text, agents);
  if (addressed) return addressed;

  const topic = detectTopic(text);
  const words = new Set(tokenize(text));
  const lastSpeaker = recentSpeakerIds[recentSpeakerIds.length - 1];

  const scored = agents.map((agent) => {
    let score = Math.random();
    const persona = personaFor(agent);

    if (persona) {
      const index = persona.affinity.indexOf(topic);
      if (index >= 0) score += 3 - index;
    } else {
      const focusWords = tokenize(`${agent.focus} ${agent.role}`).filter(
        (word) => word.length > 3
      );
      score += focusWords.filter((word) => words.has(word)).length * 2;
      // Newly added perspectives are keen to contribute.
      if (!recentSpeakerIds.includes(agent.id)) score += 1.5;
    }

    if (agent.id === lastSpeaker) score -= 2.5;
    return { agent, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].agent;
}

/** Picks someone other than `excludeId` to react, preferring contrarian voices. */
export function pickReactor(
  participants: MockParticipant[],
  excludeId: string
): MockParticipant | undefined {
  const candidates = participants.filter(
    (p) => p.kind === "agent" && p.id !== excludeId
  );
  if (candidates.length === 0) return undefined;

  const devil = candidates.find((p) => p.personaKey === "devil");
  if (devil && Math.random() < 0.4) return devil;
  return randomItem(candidates);
}

/* ---------------------------------------------------------
   Generating lines
--------------------------------------------------------- */

function customLines(participant: MockParticipant) {
  const focus = lowerFirst(participant.focus || participant.role);
  const role = participant.role;

  return {
    opening: [
      `Thanks for bringing me in. I'll be looking at this through ${focus}. Having listened so far, I think the room has underweighted it.`,
    ],
    replies: [
      `Speaking as the ${role}: the part nobody has addressed yet is ${focus}. Until we have a view on that, I'd hold off on deciding.`,
      `I want to bring this back to ${focus}. That's where I think this decision actually gets made.`,
      `From my side, ${focus} changes which of these risks matters most. It reorders the whole conversation.`,
      `There's a gap around ${focus}. I'd want at least one concrete answer there before moving forward.`,
    ],
    agree: [
      `Building on what {name} said — that ties directly into ${focus}.`,
      `{name} is onto something. Seen through ${focus}, it matters even more.`,
    ],
    disagree: [
      `I see it differently from {name}. Once you factor in ${focus}, the picture changes.`,
      `I'm not sure {name} has accounted for ${focus}. That's where I'd push back.`,
    ],
    challenges: [
      `Nobody has stress-tested this against ${focus}. If we get that wrong, the rest of the analysis doesn't hold.`,
      `We're assuming ${focus} will take care of itself. In my experience, it's usually where plans quietly break.`,
    ],
  };
}

function acknowledgement(userText: string): string {
  const words = userText.trim().split(/\s+/);
  const isQuestion = userText.trim().endsWith("?");

  if (words.length <= 9 && Math.random() < 0.35) {
    const snippet = userText.trim().replace(/[?.!]+$/, "");
    return `On "${snippet}" — `;
  }

  if (Math.random() < 0.5) {
    return randomItem(
      isQuestion
        ? ["Fair question. ", "Good question. ", "Direct answer: "]
        : ["That's a fair point. ", "I hear that. ", "Noted. "]
    );
  }

  return "";
}

function joinAcknowledgement(prefix: string, line: string): string {
  // After a quoted lead-in the sentence continues, so drop the capital —
  // unless the line opens with "I", which stays capitalised.
  if (prefix.endsWith("— ") && !/^I\b/.test(line)) {
    return prefix + line.charAt(0).toLowerCase() + line.slice(1);
  }
  return prefix + line;
}

export function generateOpening(participant: MockParticipant, used: Set<string>): string {
  const persona = personaFor(participant);
  const pool = persona ? persona.openings : customLines(participant).opening;
  return pickFresh(pool, used);
}

export function generateReply(
  participant: MockParticipant,
  userText: string,
  used: Set<string>
): string {
  const persona = personaFor(participant);
  const topic = detectTopic(userText);

  const pool = persona
    ? persona.replies[topic].length > 0
      ? persona.replies[topic]
      : persona.replies.general
    : customLines(participant).replies;

  return joinAcknowledgement(acknowledgement(userText), pickFresh(pool, used));
}

export function generateReaction(
  participant: MockParticipant,
  target: MockParticipant,
  used: Set<string>
): { text: string; agrees: boolean } {
  const persona = personaFor(participant);
  const lines = persona ?? customLines(participant);

  // Devil's Advocate disagrees most of the time; others are more balanced.
  const disagreeChance = participant.personaKey === "devil" ? 0.8 : 0.5;
  const agrees = Math.random() >= disagreeChance;

  const template = pickFresh(agrees ? lines.agree : lines.disagree, used);
  return {
    text: template.replaceAll("{name}", firstName(target.name)),
    agrees,
  };
}

export function generateChallenge(participant: MockParticipant, used: Set<string>): string {
  const persona = personaFor(participant);
  const pool = persona ? persona.challenges : customLines(participant).challenges;
  return pickFresh(pool, used);
}

/** Rough "speaking" time for a line, so longer lines hold the floor longer. */
export function speakingDuration(text: string): number {
  return Math.min(4200, Math.max(1400, text.length * 22));
}

export function thinkingDuration(): number {
  return 1100 + Math.random() * 1300;
}
