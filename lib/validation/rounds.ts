import { z } from "zod";

/** Round choice when inviting someone to an interview (shared by both invite routes). */
export const RoundChoiceSchema = z.object({
  roundId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  newRoundName: z.string().trim().max(80).nullable().optional(),
  reinvite: z.boolean().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
});
