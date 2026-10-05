import { z } from "zod";
import { IdSchema } from "./ids";

/**
 * The room's argument map. Reserved for Phase 2A: defined now so the
 * protocol has a stable home for it, but not yet produced or emitted.
 */
export const ClaimKindSchema = z.enum(["claim", "evidence", "risk", "assumption", "question"]);
export const ClaimStatusSchema = z.enum(["open", "contested", "conceded", "consensus"]);

export const ClaimSchema = z.object({
  id: IdSchema,
  authorId: IdSchema,
  kind: ClaimKindSchema,
  text: z.string().min(1).max(500),
  supports: z.array(IdSchema).max(20),
  attacks: z.array(IdSchema).max(20),
  status: ClaimStatusSchema,
});
export type Claim = z.infer<typeof ClaimSchema>;
