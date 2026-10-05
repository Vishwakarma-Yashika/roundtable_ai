import { z } from "zod";
import { ParticipantSchema, type Participant } from "./participant";

/**
 * The private, server-side definition of an AI participant. The public
 * Participant view is derived from it; goal, temperament and stance are
 * prompt inputs and never need to reach the client.
 *
 * Phase 2A extends this with incentives, expertise, debate strategy,
 * evidence standards and challenge triggers (see the architecture plan).
 */
export const PersonaSchema = ParticipantSchema.extend({
  /** What this perspective is trying to optimise for. */
  goal: z.string().max(300),
  /** How they argue, e.g. "skeptical, numbers-first". */
  temperament: z.string().max(120),
  /** Initial position on the decision: -1 strongly against … 1 strongly for. */
  stance: z.number().min(-1).max(1),
});
export type Persona = z.infer<typeof PersonaSchema>;

export function toParticipant(persona: Persona): Participant {
  const { id, name, role, icon, focus, accent, kind, isCustom } = persona;
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
