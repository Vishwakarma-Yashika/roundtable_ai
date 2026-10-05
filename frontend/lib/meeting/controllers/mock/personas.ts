import type { AccentKey } from "@/lib/meeting/types";
import type { PersonaKey } from "./types";

export type Topic = "money" | "tech" | "customer" | "risk" | "general";

export interface Persona {
  key: PersonaKey;
  /** Roles from Room Setup that map onto this persona. */
  roles: string[];
  name: string;
  role: string;
  icon: string;
  accent: AccentKey;
  focus: string;
  keywords: string[];
  /** Topics this persona gravitates towards, strongest first. */
  affinity: Topic[];
  openings: string[];
  replies: Record<Topic, string[]>;
  /** Reacting to another participant. `{name}` is replaced with their first name. */
  agree: string[];
  disagree: string[];
  /** Counterarguments used in Challenge the Room. */
  challenges: string[];
}

export const TOPIC_KEYWORDS: Record<Exclude<Topic, "general">, string[]> = {
  money: [
    "money", "cost", "price", "pricing", "revenue", "fund", "funding", "invest",
    "budget", "roi", "profit", "salary", "pay", "cash", "runway", "margin",
    "valuation", "raise", "savings", "afford",
  ],
  tech: [
    "build", "tech", "technical", "ai", "app", "platform", "code", "stack",
    "scale", "scaling", "feasible", "infrastructure", "api", "data", "mvp",
    "prototype", "engineer", "ship", "launch", "tool", "automation",
  ],
  customer: [
    "user", "users", "customer", "customers", "people", "market", "need",
    "needs", "want", "adopt", "audience", "student", "students", "client",
    "experience", "problem", "pain", "demand", "feedback", "use",
  ],
  risk: [
    "risk", "risky", "fail", "failure", "wrong", "worry", "worried", "afraid",
    "safe", "competition", "competitor", "competitors", "threat", "downside",
    "quit", "leave", "lose", "uncertain", "doubt",
  ],
};

export const PERSONAS: Record<PersonaKey, Persona> = {
  investor: {
    key: "investor",
    roles: ["Investor"],
    name: "Maya Chen",
    role: "Investor",
    icon: "💰",
    accent: "emerald",
    focus: "Opportunity, ROI and financial risk",
    keywords: ["investor", "maya"],
    affinity: ["money", "risk"],
    openings: [
      "I'll be the one asking about the money. Upside is easy to imagine — I want to know what it costs to find out whether it's real, and how long the runway is if it isn't.",
    ],
    replies: {
      money: [
        "Let's put numbers on it. If acquiring one customer costs more than they'll pay you in the first year, the model doesn't work at any scale — it just loses money faster.",
        "I'd ring-fence the downside first. Decide now how much time and cash you're willing to spend before you need a clear signal, and treat that as a hard budget.",
        "Revenue is the only validation I fully trust. Pre-orders, a paid pilot, a signed letter of intent — any of those is worth more than a hundred enthusiastic conversations.",
      ],
      tech: [
        "From where I sit, the build is the cheap part. What I'd fund is evidence of pull — the technology only matters once someone is waiting for it.",
        "Build time is burn time. Every extra month of engineering before launch is a month of runway spent without learning anything about the market.",
      ],
      customer: [
        "A big market isn't the same as a reachable one. Which specific segment can you reach cheaply in the next ninety days?",
        "I'd want to see retention before growth. Ten people who keep coming back are a better signal than a thousand sign-ups who never return.",
      ],
      risk: [
        "Risk isn't the problem — unpriced risk is. Write down the three ways this fails, put a cost on each, and decide which ones you can actually afford.",
        "The asymmetric bet is what interests me. If the downside is capped at a few months and the upside is open-ended, that's usually worth taking.",
      ],
      general: [
        "My question is still the same: what is the smallest amount of money and time that gives you a real answer here?",
        "I like the direction, but I haven't heard a number yet. What does success look like in twelve months, measured in revenue or users?",
        "There's opportunity here. I'd just want a staged plan — clear milestones where you either earn the next step or stop.",
      ],
    },
    agree: [
      "{name} is right, and it has a direct cost: that's exactly the kind of risk that kills a seed round.",
      "I'm with {name} on this. And it changes my numbers — I'd want that answered before putting serious money in.",
    ],
    disagree: [
      "I'd push back on {name} a little. Technically sound doesn't mean commercially viable — those are two separate questions.",
      "That's fair from {name}'s angle, but markets reward speed more than perfection. Waiting has its own cost.",
    ],
    challenges: [
      "We may be assuming the market will pay a premium. If the real price point is half of what we're picturing, does the plan still make sense?",
      "Nobody has priced the opportunity cost. What else could this time and money be doing — and is this clearly the better bet?",
    ],
  },
  devil: {
    key: "devil",
    roles: ["Devil's Advocate"],
    name: "Rhys Okafor",
    role: "Devil's Advocate",
    icon: "⚔️",
    accent: "rose",
    focus: "Challenges assumptions and finds weak points",
    keywords: ["devil", "advocate", "rhys", "critic"],
    affinity: ["risk", "general"],
    openings: [
      "I'll be blunt — that's my job. Most decisions like this feel right because we only look for evidence that agrees with us. I'm here to find the reasons this doesn't work.",
    ],
    replies: {
      money: [
        "Every financial plan I've seen assumes things go roughly to plan. What happens when it takes twice as long and costs twice as much? Because it usually does.",
        "You're treating the money as the constraint. I think the real constraint is attention — you can't do this halfway.",
      ],
      tech: [
        "Being able to build something has never been the hard part. Plenty of well-engineered products die because nobody needed them.",
        "I'm suspicious when the technical plan is the most detailed part of a decision. It often means we're working on the part we're most comfortable with.",
      ],
      customer: [
        "People say they want things all the time. What they actually switch to is a different story. What's the evidence anyone would change their behaviour?",
        "Who's the customer who's angry enough about this problem to try something new? If we can't name them, we don't have one yet.",
      ],
      risk: [
        "Let's be honest about the worst case — not the polite version. If this fails completely, what does your life look like a year from now?",
        "The biggest risk might not be failure. It might be a slow, ambiguous half-success that eats two years before you admit it isn't working.",
      ],
      general: [
        "I'm not convinced yet. Everything I've heard so far is about why this could work. I haven't heard a strong reason why it will.",
        "Let me ask the uncomfortable question: if a friend brought you exactly this plan, would you tell them to do it?",
        "What would change your mind? If nothing would, then we're not deciding — we're rationalising.",
      ],
    },
    agree: [
      "Exactly what {name} said. And notice nobody has a good answer to it yet.",
      "{name} just named the thing everyone has been stepping around. Let's not move on from it too quickly.",
    ],
    disagree: [
      "I don't buy {name}'s optimism there. That's an assumption dressed up as a conclusion.",
      "With respect to {name}, that argument works only if everything else goes right. What if it doesn't?",
    ],
    challenges: [
      "The core assumption here is that the problem is painful enough to act on. I haven't seen evidence for that — only enthusiasm.",
      "We might be in an echo chamber. Every participant has evaluated the plan, but nobody has seriously argued for the alternative of doing nothing.",
      "Worst case: this works just well enough to keep going, but never well enough to succeed. How would you even recognise that early?",
    ],
  },
  engineer: {
    key: "engineer",
    roles: ["Technical Expert"],
    name: "Dev Patel",
    role: "Technical Expert",
    icon: "💻",
    accent: "sky",
    focus: "Feasibility, complexity and scalability",
    keywords: ["technical", "engineer", "expert", "dev"],
    affinity: ["tech"],
    openings: [
      "I'll cover feasibility. My instinct is that the first version is more achievable than it looks — the hard part tends to arrive later, at scale and in the edge cases.",
    ],
    replies: {
      money: [
        "On cost, the infrastructure is unlikely to be the big line item early on. People's time is. A scrappy prototype can be built for very little.",
        "Watch the variable costs, though. If every user action triggers a paid API call, your margins get squeezed as you grow.",
      ],
      tech: [
        "Technically this is very doable. I'd build the thinnest possible version in a couple of weeks and put it in front of real people before adding anything.",
        "The tricky bits are rarely the core feature. It's reliability, data quality and the long tail of edge cases. Plan for those, not just the demo.",
        "I'd avoid building custom infrastructure early. Use off-the-shelf tools until you're sure what actually needs to be custom.",
      ],
      customer: [
        "From an engineering standpoint, user feedback is the cheapest way to avoid building the wrong thing. Instrument everything from day one.",
        "If users need it to work perfectly before they'll trust it, that raises the technical bar significantly. Is good-enough acceptable to them?",
      ],
      risk: [
        "The technical risk is manageable. What worries me is dependency risk — relying on a platform or API that could change its pricing or terms overnight.",
        "Scale risk is real, but it's a good problem to have. I wouldn't optimise for it before you have a single committed user.",
      ],
      general: [
        "I keep coming back to scope. What's the smallest version that would genuinely test this decision?",
        "There's a version of this I could prototype quickly. That would replace a lot of speculation with real data.",
        "Let's separate what's hard from what's just unfamiliar. Most of this is the second kind.",
      ],
    },
    agree: [
      "Good point from {name}. And that's testable — we could get a real answer in a couple of weeks rather than guessing.",
      "{name} is right, and there's a technical angle: the shortcut we take now becomes the thing we have to rewrite later.",
    ],
    disagree: [
      "I'd challenge {name} there — that's a solvable engineering problem, not a reason to stop.",
      "I see {name}'s concern, but it's overstated. We can de-risk that with a small prototype before committing anything.",
    ],
    challenges: [
      "We're assuming the first version can be built cheaply. If the quality bar users expect is higher than we think, that timeline could triple.",
      "There's a hidden dependency risk. If one external platform changes its pricing or policy, how much of this plan survives?",
    ],
  },
  customer: {
    key: "customer",
    roles: ["Customer"],
    name: "Sam Rivera",
    role: "Customer",
    icon: "👤",
    accent: "amber",
    focus: "Real user needs and experience",
    keywords: ["customer", "user", "sam"],
    affinity: ["customer", "general"],
    openings: [
      "I'm here as the person who'd actually use this. Honestly, I don't care how clever it is — I care whether it saves me time or fixes something that annoys me every week.",
    ],
    replies: {
      money: [
        "As a customer, I'd pay if it clearly replaces something I'm already paying for or wasting hours on. Otherwise it's a nice-to-have, and those are the first thing I cancel.",
        "Free trials get me in the door, but I decide in the first five minutes. If I don't see value immediately, I'm gone.",
      ],
      tech: [
        "I won't notice the technology. I'll notice if it's slow, confusing or asks me for too much information up front.",
        "Please don't build ten features. Build the one I'd use every day and make it really good.",
      ],
      customer: [
        "Speaking as a user: I already have a way of handling this problem. It's messy, but it works. You'd have to be clearly better, not just slightly better.",
        "Ask people what they did the last time they had this problem — not whether they'd use your idea. That's where the real answer is.",
      ],
      risk: [
        "My risk is wasting time learning something new that disappears in six months. Trust matters more to me than features.",
        "If I'm handing over my data or my money, I need to know who's behind this and that it'll still be here next year.",
      ],
      general: [
        "From the outside, I'm still not sure who this is for. If you can't explain it to me in one sentence, I probably won't try it.",
        "Honestly, I'd want to try a rough version before forming an opinion. Can I get my hands on something?",
        "I think you're closer than the others are making it sound — but only if it fits into my day without extra effort.",
      ],
    },
    agree: [
      "Yes — {name} is describing exactly how I'd behave as a customer.",
      "I agree with {name}. From the user side, that's the moment I'd decide whether to stay or leave.",
    ],
    disagree: [
      "I don't think {name} is seeing it from my side. I wouldn't think about it that way at all.",
      "That might matter to {name}, but as a customer I wouldn't even notice it. What I'd notice is something else entirely.",
    ],
    challenges: [
      "We're assuming customers feel this problem strongly. Most people I know have quietly learned to live with it.",
      "Switching costs are being ignored. Even if this is better, I'd have to stop using what I already know — that's a real barrier.",
    ],
  },
};

export const MODERATOR = {
  id: "moderator",
  name: "Ada",
  role: "Moderator",
  icon: "◉",
  accent: "violet" as AccentKey,
  focus: "Keeps the discussion balanced and moving",
  keywords: ["moderator", "ada"],
};

/** Quotes a phrase as a sentence, without doubling up end punctuation. */
function quoted(text: string): string {
  return /[.?!]$/.test(text) ? `"${text}"` : `"${text}."`;
}

export const MODERATOR_LINES = {
  opening: (decision: string) =>
    `Welcome to the room. We're here to pressure-test one decision: ${quoted(decision)} Each perspective will open with where they stand, then it's an open floor — interrupt whenever you like.`,
  openingHandoff:
    "That's the room. You've heard where everyone stands — where would you like to start?",
  handBack: [
    "Let's pause there. There's real disagreement on the table — what's your read so far?",
    "Good exchange. Before we go further: which of these concerns feels most real to you?",
    "We've got two competing views. Is there information you have that we don't?",
  ],
  summary: [
    "Let me summarise. The open questions are whether demand is real, what this costs to test, and what the worst case looks like. Those are the threads to pull on.",
    "So far the room agrees this is feasible. Where it splits is on whether the demand is strong enough to justify the cost.",
    "Noting a pattern: the optimism is about the solution, the concerns are about the problem. That's worth taking seriously.",
  ],
  challengeStart: (assumption: string) =>
    `Challenge mode. I'm asking every perspective to attack the current position: ${quoted(assumption)} What assumption are we making, what evidence is missing, and what could make this completely wrong?`,
  challengeEnd: [
    "Challenge round complete. The weakest points are untested demand and an unpriced downside. I'd treat those as the next things to validate before deciding.",
    "That's the stress test. The position survives, but it rests on assumptions nobody here has verified yet. Which one do you want to test first?",
  ],
  welcome: (name: string, role: string) =>
    `Welcome, ${name}. You're joining as our ${role}. Feel free to come in on anything we've covered so far.`,
};
