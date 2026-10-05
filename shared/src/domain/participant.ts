import { z } from "zod";
import { IdSchema } from "./ids";

export const AccentKeySchema = z.enum([
  "violet",
  "emerald",
  "rose",
  "sky",
  "amber",
  "fuchsia",
  "cyan",
  "lime",
  "orange",
  "indigo",
]);
export type AccentKey = z.infer<typeof AccentKeySchema>;

export const ParticipantKindSchema = z.enum(["agent", "moderator"]);
export type ParticipantKind = z.infer<typeof ParticipantKindSchema>;

/** The public view of a room participant — what every client may see. */
export const ParticipantSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60),
  role: z.string().min(1).max(60),
  /** Emoji icon. Participants without one render initials. */
  icon: z.string().max(16).optional(),
  /** One-line description of what this perspective cares about. */
  focus: z.string().max(300),
  accent: AccentKeySchema,
  kind: ParticipantKindSchema,
  /** True for perspectives added by the user during the meeting. */
  isCustom: z.boolean().optional(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

/** Fields that may change after a participant joins. */
export const ParticipantPatchSchema = ParticipantSchema.omit({
  id: true,
  kind: true,
}).partial();
export type ParticipantPatch = z.infer<typeof ParticipantPatchSchema>;
