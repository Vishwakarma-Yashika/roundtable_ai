import { perspectives } from "@/lib/perspectives";
import type { RoomConfig } from "./types";

const STORAGE_KEY = "roundtable:room-config";

/** Upper bounds that keep tampered or stale storage from breaking the layout. */
const MAX_DECISION_LENGTH = 500;
const MAX_FIELD_LENGTH = 240;
const MAX_PERSPECTIVES = 12;

/** Used when the room is opened directly, without going through Room Setup. */
export const DEMO_ROOM_CONFIG: RoomConfig = {
  decision: "Should I build this startup?",
  perspectives: perspectives.map(({ role, icon, description }) => ({
    role,
    icon,
    description,
  })),
};

export function saveRoomConfig(config: RoomConfig): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
    // The room then falls back to the demo configuration.
  }
}

/** Raw stored value; a string snapshot is stable for useSyncExternalStore. */
export function readStoredRoomConfig(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Parses stored room state defensively: storage is user-controlled and may
 * be missing, stale or malformed. Invalid perspectives are dropped and
 * duplicate roles collapsed; returns null when nothing usable remains.
 */
export function parseRoomConfig(raw: string | null): RoomConfig | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const candidate = parsed as { decision?: unknown; perspectives?: unknown };
  const decision = cleanString(candidate.decision, MAX_DECISION_LENGTH);
  if (!decision || !Array.isArray(candidate.perspectives)) return null;

  const seenRoles = new Set<string>();
  const cleaned: RoomConfig["perspectives"] = [];

  for (const item of candidate.perspectives) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const role = cleanString(entry.role, MAX_FIELD_LENGTH);
    if (!role || seenRoles.has(role.toLowerCase())) continue;

    seenRoles.add(role.toLowerCase());
    cleaned.push({
      role,
      icon: cleanString(entry.icon, 8) ?? "",
      description: cleanString(entry.description, MAX_FIELD_LENGTH) ?? role,
    });
    if (cleaned.length === MAX_PERSPECTIVES) break;
  }

  return cleaned.length > 0 ? { decision, perspectives: cleaned } : null;
}
