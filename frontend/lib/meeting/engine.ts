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
import type {
  MeetingController,
  MeetingSnapshot,
  Message,
  MessageTone,
  NewPerspectiveInput,
  Participant,
  RoomConfig,
} from "./types";

interface TurnPlan {
  speakerId: string;
  kind: "agent" | "moderator";
  text: string;
  tone?: MessageTone;
  replyToId?: string;
  thinkMs?: number;
  onSpoken?: () => void;
}

/** A turn is planned lazily, when it reaches the front of the queue. */
type Step = () => TurnPlan | null;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Local, mock-data simulation of a multi-agent meeting.
 *
 * Turns run one at a time through a queue: the speaker "thinks", their
 * message lands, they hold the floor while "speaking", then the next turn
 * starts. User actions interrupt the queue, like interrupting a real room.
 *
 * Implements MeetingController, the seam where a WebSocket-backed client
 * can later replace it.
 */
export class MeetingEngine implements MeetingController {
  private snapshot: MeetingSnapshot;
  private readonly listeners = new Set<() => void>();
  private queue: Step[] = [];
  private busy = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly usedLines = new Set<string>();
  private startedAt = 0;

  constructor(private readonly config: RoomConfig) {
    this.snapshot = {
      participants: buildParticipants(config),
      messages: [],
      activity: null,
      mode: "discussion",
      challengeAssumption: null,
      ended: false,
      durationSeconds: 0,
    };
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
    if (!this.startedAt) this.startedAt = Date.now();

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

    const patch: Partial<MeetingSnapshot> = {};
    if (this.snapshot.activity) patch.activity = null;
    if (this.snapshot.mode === "challenge") {
      patch.mode = "discussion";
      patch.challengeAssumption = null;
    }
    if (Object.keys(patch).length > 0) this.update(patch);
  }

  /* ---------------- User actions ---------------- */

  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.snapshot.ended) return;

    this.interrupt();
    this.append({ kind: "user", text: trimmed, tone: "default" });

    const agentCount = this.agents().length;
    const steps: Step[] = [this.replyStep(trimmed)];

    if (agentCount > 1 && Math.random() < 0.75) steps.push(this.reactionStep());
    if (agentCount > 2 && Math.random() < 0.35) steps.push(this.reactionStep());
    steps.push(this.moderatorCheckStep());

    this.enqueue(...steps);
  }

  challengeRoom(): void {
    if (this.snapshot.ended || this.snapshot.mode === "challenge") return;

    this.interrupt();

    const lastUserMessage = [...this.snapshot.messages]
      .reverse()
      .find((m) => m.kind === "user");
    const assumption = lastUserMessage?.text ?? this.config.decision;

    this.update({ mode: "challenge", challengeAssumption: assumption });

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
        onSpoken: () =>
          this.update({ mode: "discussion", challengeAssumption: null }),
      })
    );
  }

  addPerspective(input: NewPerspectiveInput): void {
    if (this.snapshot.ended) return;

    const participant = createCustomParticipant(
      input,
      this.snapshot.participants.map((p) => p.accent)
    );

    this.interrupt();
    this.update({
      participants: [...this.snapshot.participants, participant],
    });
    this.append({
      kind: "system",
      text: `${participant.name} joined the room as ${participant.role}`,
      tone: "default",
    });

    this.enqueue(
      this.moderatorStep(
        MODERATOR_LINES.welcome(participant.name, participant.role),
        600
      ),
      () => this.agentPlan(participant.id, (p) => generateOpening(p, this.usedLines)),
      () => {
        const reactor = pickReactor(this.snapshot.participants, participant.id);
        if (!reactor) return null;
        return {
          speakerId: reactor.id,
          kind: "agent",
          text: generateReaction(reactor, participant, this.usedLines).text,
          replyToId: participant.id,
        };
      }
    );
  }

  end(): void {
    if (this.snapshot.ended) return;

    this.interrupt();
    const durationSeconds = this.getElapsedSeconds();
    this.append({ kind: "system", text: "Meeting ended", tone: "default" });
    this.update({ ended: true, durationSeconds });
  }

  /* ---------------- Turn planning ---------------- */

  private openingSteps(): Step[] {
    return [
      this.moderatorStep(MODERATOR_LINES.opening(this.config.decision), 900),
      ...this.agents().map(
        (agent): Step =>
          () =>
            this.agentPlan(agent.id, (p) => generateOpening(p, this.usedLines))
      ),
      this.moderatorStep(MODERATOR_LINES.openingHandoff),
    ];
  }

  private replyStep(userText: string): Step {
    return () => {
      const responder = pickResponder(
        userText,
        this.snapshot.participants,
        this.recentSpeakerIds()
      );
      if (!responder) {
        return this.moderatorPlan(
          "There's nobody else in the room yet. Add a perspective and I'll bring them in."
        );
      }
      return this.agentPlan(responder.id, (p) =>
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

      const reactor = pickReactor(this.snapshot.participants, target.id);
      if (!reactor) return null;

      return {
        speakerId: reactor.id,
        kind: "agent",
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
      const plan = this.agentPlan(agentId, (p) =>
        generateChallenge(p, this.usedLines)
      );
      return plan ? { ...plan, tone: "challenge" } : null;
    };
  }

  private moderatorStep(text: string, thinkMs?: number, tone?: MessageTone): Step {
    return () => ({ ...this.moderatorPlan(text, thinkMs), tone });
  }

  private moderatorPlan(text: string, thinkMs?: number): TurnPlan {
    return { speakerId: MODERATOR.id, kind: "moderator", text, thinkMs };
  }

  private agentPlan(
    agentId: string,
    write: (participant: Participant) => string
  ): TurnPlan | null {
    // The participant may have been removed or the room ended meanwhile.
    const participant = this.participant(agentId);
    if (!participant) return null;
    return { speakerId: participant.id, kind: "agent", text: write(participant) };
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
    this.busy = true;
    this.update({ activity: { participantId: turn.speakerId, phase: "thinking" } });

    this.later(() => {
      this.append({
        kind: turn.kind,
        authorId: turn.speakerId,
        text: turn.text,
        tone: turn.tone ?? "default",
        replyToId: turn.replyToId,
      });
      this.update({ activity: { participantId: turn.speakerId, phase: "speaking" } });

      this.later(() => {
        this.update({ activity: null });
        turn.onSpoken?.();
        this.busy = false;
        this.pump();
      }, speakingDuration(turn.text));
    }, turn.thinkMs ?? thinkingDuration());
  }

  /** Drops whatever the room was about to say, like being interrupted. */
  private interrupt(): void {
    this.stop();
  }

  /* ---------------- Internals ---------------- */

  private agents(): Participant[] {
    return this.snapshot.participants.filter((p) => p.kind === "agent");
  }

  private participant(id: string): Participant | undefined {
    return this.snapshot.participants.find((p) => p.id === id);
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

  private append(draft: Omit<Message, "id" | "at">): void {
    const message: Message = {
      ...draft,
      id: createId("msg"),
      at: this.getElapsedSeconds(),
    };
    this.update({ messages: [...this.snapshot.messages, message] });
  }

  private update(patch: Partial<MeetingSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
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
