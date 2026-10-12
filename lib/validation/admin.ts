import { z } from "zod";

/** Free-interview quota: a whole number, or null for unlimited. */
export const QuotaSchema = z.number().int().min(0, "Quota can't be negative").max(100000).nullable();

export const CompanyInviteSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  quota: QuotaSchema,
});
