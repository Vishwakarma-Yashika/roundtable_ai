import { z } from "zod";
import { IdSchema } from "./ids";

const CitedPointSchema = z.object({
  text: z.string().min(1).max(500),
  /** Ledger claim ids this point is grounded in. */
  claimIds: z.array(IdSchema).max(10),
});

/**
 * Final Room Verdict. Reserved for Phase 2A: defined now so the protocol
 * has a stable home for it, but not yet produced or emitted.
 */
export const VerdictSchema = z.object({
  recommendation: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  strongestFor: CitedPointSchema,
  strongestAgainst: CitedPointSchema,
  biggestRisk: CitedPointSchema,
  mostImportantUnknown: z.string().min(1).max(500),
  dissent: z.array(z.object({ participantId: IdSchema, reason: z.string().max(500) })).max(12),
  nextSteps: z.array(z.string().min(1).max(300)).min(1).max(5),
});
export type Verdict = z.infer<typeof VerdictSchema>;
