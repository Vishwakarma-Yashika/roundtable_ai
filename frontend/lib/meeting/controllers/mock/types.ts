import type { Participant } from "@/lib/meeting/types";

export type PersonaKey = "investor" | "devil" | "engineer" | "customer";

/**
 * A participant as the mock engine sees it: the public Participant plus
 * simulation-only data that must never become part of the protocol.
 */
export interface MockParticipant extends Participant {
  /** Lower-case keywords that make this participant likely to respond. */
  keywords: string[];
  /** Persona key into the mock line library; undefined for custom perspectives. */
  personaKey?: PersonaKey;
}
