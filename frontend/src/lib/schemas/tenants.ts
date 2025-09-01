import { emptyToUndefined } from "@/lib/zod-helpers";
import { z } from "zod";

export const signupSchema = z.object({
  tenantName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  description: emptyToUndefined(),
  logo: emptyToUndefined(),
  customDomain: emptyToUndefined(),
  trialDays: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(1).max(365).optional()
  ),
  acceptTerms: z.literal(true).refine((val) => val === true, {
    message: "Vous devez accepter les CGU",
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;
