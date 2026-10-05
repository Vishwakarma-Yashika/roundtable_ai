import { randomBytes } from "node:crypto";
import type { CreateRoomRequest, ServerEvent } from "@roundtable/shared";
import type { LlmProvider } from "../llm/LlmProvider";
import { buildPersonas } from "./personas";
import { RoomActor, type RoomTiming } from "./RoomActor";

export interface RoomRegistryOptions {
  llm: LlmProvider;
  /** Publishes a room's events (the gateway broadcasts them). */
  onEvent: (roomId: string, event: ServerEvent) => void;
  maxRooms: number;
  timing?: Partial<RoomTiming>;
  /** Ended rooms stay joinable this long so clients can read the transcript. */
  endedRoomTtlMs?: number;
  /** Rooms are evicted after this long regardless of state (no persistence yet). */
  maxRoomAgeMs?: number;
  onError?: (error: unknown) => void;
  now?: () => number;
}

export class RoomLimitError extends Error {
  constructor() {
    super("Room limit reached");
  }
}

/** 128 random bits, base64url: unguessable and safe in URLs (22 chars). */
export function newRoomId(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * In-memory index of live rooms. Creates and evicts RoomActors; never
 * touches room state itself. Replaced by persistence-backed lookup in 2D.
 */
export class RoomRegistry {
  private readonly rooms = new Map<string, RoomActor>();
  private readonly endedAt = new Map<string, number>();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;

  constructor(private readonly options: RoomRegistryOptions) {
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.rooms.size;
  }

  create(request: CreateRoomRequest): RoomActor {
    if (this.rooms.size >= this.options.maxRooms) {
      this.sweep();
      if (this.rooms.size >= this.options.maxRooms) throw new RoomLimitError();
    }

    let roomId = newRoomId();
    while (this.rooms.has(roomId)) roomId = newRoomId();

    const actor = new RoomActor({
      roomId,
      decision: request.decision,
      personas: buildPersonas(request.perspectives),
      llm: this.options.llm,
      timing: this.options.timing,
      now: this.options.now,
      onError: this.options.onError,
      onEvent: (event) => {
        if (event.type === "room.ended") this.endedAt.set(roomId, this.now());
        this.options.onEvent(roomId, event);
      },
    });
    this.rooms.set(roomId, actor);
    return actor;
  }

  get(roomId: string): RoomActor | undefined {
    return this.rooms.get(roomId);
  }

  /** Evicts ended rooms past their grace period and rooms past their max age. */
  sweep(): void {
    const now = this.now();
    const endedTtl = this.options.endedRoomTtlMs ?? 10 * 60_000;
    const maxAge = this.options.maxRoomAgeMs ?? 4 * 60 * 60_000;

    for (const [roomId, actor] of this.rooms) {
      const endedAt = this.endedAt.get(roomId);
      const expired = endedAt !== undefined ? now - endedAt > endedTtl : now - actor.createdAt > maxAge;
      if (expired) this.remove(roomId);
    }
  }

  startSweeper(intervalMs = 60_000): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), intervalMs);
    this.sweeper.unref();
  }

  disposeAll(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    for (const roomId of [...this.rooms.keys()]) this.remove(roomId);
  }

  private remove(roomId: string): void {
    this.rooms.get(roomId)?.dispose();
    this.rooms.delete(roomId);
    this.endedAt.delete(roomId);
  }
}
