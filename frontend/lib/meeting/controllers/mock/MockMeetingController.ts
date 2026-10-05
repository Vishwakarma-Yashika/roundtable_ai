import {
  applyEvent,
  createEvent,
  createInitialSnapshot,
  type MeetingSnapshot,
  type Message,
  type MessageTone,
  type Participant,
  type ServerEventPayload,
  type ServerEventType,
  type TurnIntent,
} from "@roundtable/shared";
import type {
  MeetingCapabilities,
  MeetingController,
  NewPerspectiveInput,
  RoomConfig,
} from "@/lib/meeting/types";
import { MODERATOR, MODERATOR_LINES } from "./personas";
import {
  buildParticipants,
  createCustomParticipant,
  createId,
  generateChallenge,
  generateOpening,
  generateReaction,
  generateReply,
  pickFresh,
  pickReactor,
  pickResponder,
  randomItem,
  speakingDuration,
  thinkingDuration,
} from "./simulation";
import type { MockParticipant } from "./types";

const MOCK_ROOM_ID = "mock-room";

interface TurnPlan {
  speakerId: string;
  kind: "agent" | "moderator";
  intent: TurnIntent;
  text: string;
  tone?: MessageTone;
  replyToId?: string;
  thinkMs?: number;
  onSpoken?: () => void;
}

/** A turn is planned lazily, when it reaches the front of the queue. */
type Step = () => TurnPlan | null;

interface ActiveTurn {
  turnId: string;
  speakerId: string;
  /** Set once the message has started; absent while still "thinking". */
  message?: Message;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks the public fields, so simulation-only data never enters the snapshot. */
function toPublicParticipant(participant: MockParticipant): Participant {
  const { id, name, role, icon, focus, accent, kind, isCustom } = participant;
  return {
    id,
    name,
    role,
    focus,
    accent,
    kind,
    ...(icon !== undefined && { icon }),
    ...(isCustom !== undefined && { isCustom }),
  };
}

/**
 * Local, mock-data simulation of a multi-agent meeting.
 *
 * Turns run one at a time through a queue: the speaker "thinks", their
 * message lands, they hold the floor while "speaking", then the next turn
 * starts. User actions interrupt the queue, like interrupting a real room.
 *
 * Every state change is a protocol event folded through the shared
 * reducer, exactly as the live controller does with server events, so
 * both controllers produce snapshots the same way.
 */
export class MockMeetingController implements MeetingController {
  readonly capabilities: MeetingCapabilities = { challenge: true, addPerspective: true };

  private snapshot: MeetingSnapshot;
  /** Participants with simulation data; the snapshot holds their public view. */
  private readonly roster: MockParticipant[];
  private readonly listeners = new Set<() => void>();
  private queue: Step[] = [];
  private busy = false;
  private activeTurn: ActiveTurn | null = null;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly usedLines = new Set<string>();
  private seq = 0;
  private startedAt = 0;

  constructor(private readonly config: RoomConfig) {
    this.snapshot = createInitialSnapshot(MOCK_ROOM_ID, {
      decision: config.decision,
      connection: "live",
    });
    this.roster = buildParticipants(config);
    for (const participant of this.roster) {
      this.emit("participant.joined", { participant: toPublicParticipant(participant) });
    }
  }

  /* ---------------- Store interface ---------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): MeetingSnapshot => this.snapshot;

  getElapsedSeconds = (): number =>
    this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;

  /* ---------------- Lifecycle ---------------- */

  start(): void {
    if (this.snapshot.ended) return;
    if (!this.startedAt) {
      this.startedAt = Date.now();
      this.emit("room.phase_changed", { phase: "opening", startedAt: this.startedAt });
    }

    // Only open the meeting once, even if React mounts the room twice.
    if (this.snapshot.messages.length === 0) {
      this.later(() => this.enqueue(...this.openingSteps()), 600);
    }
  }

  /**
   * Cancels all pending turns. Also resets transient state, so a turn that
   * was cut off can't leave a stale "thinking" indicator or a challenge
   * round that never closes if the engine is started again.
   */
  stop(): void {
    this.clearTimers();
    this.queue = [];
    this.busy = false;

    const turn = this.activeTurn;
    this.activeTurn = null;
    if (turn) {
      // The mock delivers a message's full text when it starts, so a cut-off
      // message is kept as shown (matching the original demo behaviour).
      if (turn.message) {
        this.emit("message.completed", {
          turnId: turn.turnId,
          message: { ...turn.message, status: "complete" },
        });
      }
      this.emit("turn.ended", { turnId: turn.turnId, speakerId: turn.speakerId, outcome: "aborted" });
    }
    if (this.snapshot.mode === "challenge") this.emit("challenge.ended", {});
  }

  /* ---------------- User actions ---------------- */

  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.snapshot.ended) return;

    this.stop();
    this.emit("user.message.accepted", {
      clientMsgId: createId("local"),
      message: this.message({ kind: "user", text: trimmed, tone: "default", status: "complete" }),
    });

    const agentCount = this.agents().length;
    const steps: Step[] = [this.replyStep(trimmed)];

    if (agentCount > 1 && Math.random() < 0.75) steps.push(this.reactionStep());
    if (agentCount > 2 && Math.random() < 0.35) steps.push(this.reactionStep());
    steps.push(this.moderatorCheckStep());

    this.enqueue(...steps);
  }

  interrupt(): void {
    if (this.snapshot.ended) return;
    this.stop();
  }

  challengeRoom(): void {
    if (this.snapshot.ended || this.snapshot.mode === "challenge") return;

    this.stop();

    const lastUserMessage = [...this.snapshot.messages]
      .reverse()
      .find((m) => m.kind === "user");
    const assumption = lastUserMessage?.text ?? this.config.decision;

    this.emit("challenge.started", { assumption });

    // The Devil's Advocate leads; everyone else follows in random order.
    const agents = this.agents();
    const devil = agents.filter((a) => a.personaKey === "devil");
    const others = shuffle(agents.filter((a) => a.personaKey !== "devil"));
    const challengers = [...devil, ...others].slice(0, 4);

    this.enqueue(
      this.moderatorStep(MODERATOR_LINES.challengeStart(assumption), 700, "challenge"),
      ...challengers.map((agent) => this.challengeStep(agent.id)),
      () => ({
        ...this.moderatorPlan(randomItem(MODERATOR_LINES.challengeEnd)),
        onSpoken: () => this.emit("challenge.ended", {}),
      })
    );
  }

  addPerspective(input: NewPerspectiveInput): void {
    if (this.snapshot.ended) return;

    const participant = createCustomParticipant(
      input,
      this.roster.map((p) => p.accent)
    );

    this.stop();
    this.roster.push(participant);
    this.emit("participant.joined", { participant: toPublicParticipant(participant) });
    this.emit("message.completed", {
      message: this.message({
        kind: "system",
        text: `${participant.name} joined the room as ${participant.role}`,
        tone: "default",
        status: "complete",
      }),
    });

    this.enqueue(
      this.moderatorStep(
        MODERATOR_LINES.welcome(participant.name, participant.role),
        600
      ),
      () => this.agentPlan(participant.id, "welcome", (p) => generateOpening(p, this.usedLines)),
      () => {
        const reactor = pickReactor(this.roster, participant.id);
        if (!reactor) return null;
        return {
          speakerId: reactor.id,
          kind: "agent",
          intent: "reaction",
          text: generateReaction(reactor, participant, this.usedLines).text,
          replyToId: participant.id,
        };
      }
    );
  }

  end(): void {
    if (this.snapshot.ended) return;

    this.stop();
    const durationSeconds = this.getElapsedSeconds();
    this.emit("message.completed", {
      message: this.message({ kind: "system", text: "Meeting ended", tone: "default", status: "complete" }),
    });
    this.emit("room.ended", { reason: "user", durationSeconds });
  }

  /* ---------------- Turn planning ---------------- */

  private openingSteps(): Step[] {
    return [
      this.moderatorStep(MODERATOR_LINES.opening(this.config.decision), 900),
      ...this.agents().map(
        (agent): Step =>
          () =>
            this.agentPlan(agent.id, "opening", (p) => generateOpening(p, this.usedLines))
      ),
      () => {
        const plan = this.moderatorPlan(MODERATOR_LINES.openingHandoff);
        return {
          ...plan,
          onSpoken: () => {
            if (this.snapshot.phase === "opening") this.emit("room.phase_changed", { phase: "debate" });
          },
        };
      },
    ];
  }

  private replyStep(userText: string): Step {
    return () => {
      const responder = pickResponder(userText, this.roster, this.recentSpeakerIds());
      if (!responder) {
        return this.moderatorPlan(
          "There's nobody else in the room yet. Add a perspective and I'll bring them in."
        );
      }
      return this.agentPlan(responder.id, "reply", (p) =>
        generateReply(p, userText, this.usedLines)
      );
    };
  }

  /** Another agent responds directly to whoever spoke last. */
  private reactionStep(): Step {
    return () => {
      const lastAgentMessage = [...this.snapshot.messages]
        .reverse()
        .find((m) => m.kind === "agent");
      const target = lastAgentMessage?.authorId
        ? this.participant(lastAgentMessage.authorId)
        : undefined;
      if (!target) return null;

      const reactor = pickReactor(this.roster, target.id);
      if (!reactor) return null;

      return {
        speakerId: reactor.id,
        kind: "agent",
        intent: "reaction",
        text: generateReaction(reactor, target, this.usedLines).text,
        replyToId: target.id,
      };
    };
  }

  /** The moderator steps in only when the discussion needs steering. */
  private moderatorCheckStep(): Step {
    return () => {
      const messages = this.snapshot.messages;
      let agentTurns = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].kind === "moderator") break;
        if (messages[i].kind === "agent") agentTurns++;
      }

      if (agentTurns >= 5) {
        return this.moderatorPlan(this.fresh(MODERATOR_LINES.summary));
      }
      if (agentTurns >= 2 && Math.random() < 0.35) {
        return this.moderatorPlan(this.fresh(MODERATOR_LINES.handBack));
      }
      return null;
    };
  }

  private challengeStep(agentId: string): Step {
    return () => {
      const plan = this.agentPlan(agentId, "challenge", (p) =>
        generateChallenge(p, this.usedLines)
      );
      return plan ? { ...plan, tone: "challenge" } : null;
    };
  }

  private moderatorStep(text: string, thinkMs?: number, tone?: MessageTone): Step {
    return () => ({ ...this.moderatorPlan(text, thinkMs), tone });
  }

  private moderatorPlan(text: string, thinkMs?: number): TurnPlan {
    return { speakerId: MODERATOR.id, kind: "moderator", intent: "moderation", text, thinkMs };
  }

  private agentPlan(
    agentId: string,
    intent: TurnIntent,
    write: (participant: MockParticipant) => string
  ): TurnPlan | null {
    // The participant may have been removed or the room ended meanwhile.
    const participant = this.participant(agentId);
    if (!participant) return null;
    return { speakerId: participant.id, kind: "agent", intent, text: write(participant) };
  }

  /* ---------------- Queue ---------------- */

  private enqueue(...steps: Step[]): void {
    this.queue.push(...steps);
    this.pump();
  }

  private pump(): void {
    if (this.busy || this.snapshot.ended) return;

    let plan: TurnPlan | null = null;
    while (!plan && this.queue.length > 0) {
      plan = this.queue.shift()!();
    }
    if (!plan) return;

    const turn = plan;
    const turnId = createId("turn");
    this.busy = true;
    this.activeTurn = { turnId, speakerId: turn.speakerId };
    this.emit("turn.started", { turnId, speakerId: turn.speakerId, intent: turn.intent });

    this.later(() => {
      const message = this.message({
        kind: turn.kind,
        authorId: turn.speakerId,
        text: turn.text,
        tone: turn.tone ?? "default",
        replyToId: turn.replyToId,
        status: "streaming",
      });
      this.activeTurn = { turnId, speakerId: turn.speakerId, message };
      this.emit("message.started", { turnId, message });

      this.later(() => {
        this.activeTurn = null;
        this.emit("message.completed", { turnId, message: { ...message, status: "complete" } });
        this.emit("turn.ended", { turnId, speakerId: turn.speakerId, outcome: "completed" });
        turn.onSpoken?.();
        this.busy = false;
        this.pump();
      }, speakingDuration(turn.text));
    }, turn.thinkMs ?? thinkingDuration());
  }

  /* ---------------- Internals ---------------- */

  private agents(): MockParticipant[] {
    return this.roster.filter((p) => p.kind === "agent");
  }

  private participant(id: string): MockParticipant | undefined {
    return this.roster.find((p) => p.id === id);
  }

  private recentSpeakerIds(): string[] {
    return this.snapshot.messages
      .filter((m) => m.kind === "agent" && m.authorId)
      .slice(-4)
      .map((m) => m.authorId!);
  }

  private fresh(pool: readonly string[]): string {
    return pickFresh(pool, this.usedLines);
  }

  private message(draft: Omit<Message, "id" | "at">): Message {
    return { ...draft, id: createId("msg"), at: this.getElapsedSeconds() };
  }

  /** The only way state changes: build a protocol event and fold it in. */
  private emit<T extends ServerEventType>(type: T, payload: ServerEventPayload<T>): void {
    const event = createEvent(type, payload, {
      roomId: MOCK_ROOM_ID,
      seq: ++this.seq,
      ts: Date.now(),
    });
    this.snapshot = applyEvent(this.snapshot, event);
    this.listeners.forEach((listener) => listener());
  }

  private later(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
}
