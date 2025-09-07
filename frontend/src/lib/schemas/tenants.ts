import { emptyToUndefined } from "@/lib/zod-helpers";
import { z } from "zod";

export const signupSchema = z.object({
  tenantName: z
    .string()
    .min(1, { message: "Le nom de l'organisation est requis" })
    .min(2, { message: "Le nom doit contenir au moins 2 caractères" })
    .max(100, { message: "Le nom ne peut pas dépasser 100 caractères" }),
  slug: z
    .string()
    .min(1, { message: "Le slug est requis" })
    .min(2, { message: "Le slug doit contenir au moins 2 caractères" })
    .max(50, { message: "Le slug ne peut pas dépasser 50 caractères" })
    .regex(/^[a-z0-9-]+$/, {
      message:
        "Le slug ne doit contenir que des lettres minuscules, chiffres et tirets",
    }),
  adminName: z.string().min(1, {
    message: "Le nom de l'administrateur est requis",
  }),
  adminEmail: z
    .string()
    .min(1, { message: "L'adresse e-mail est requise" })
    .email({ message: "Adresse e-mail invalide" })
    .max(254, { message: "L'adresse e-mail est trop longue" })
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: "Format d'adresse e-mail invalide",
    })
    .toLowerCase(),
  adminPassword: z
    .string()
    .min(1, { message: "Le mot de passe est requis" })
    .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
    .regex(/[a-z]/, {
      message: "Une lettre minuscule requise",
    })
    .regex(/[A-Z]/, {
      message: "Une lettre majuscule requise",
    })
    .regex(/[!@#$%^&*(),.?":{}|<>]/, {
      message: "Un caractère spécial requis",
    }),
  description: emptyToUndefined(),
  logo: emptyToUndefined(),
  customDomain: emptyToUndefined(),
  trialDays: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z
      .number({ message: "Le nombre de jours d'essai est invalide" })
      .min(1, { message: "L'essai doit être d'au moins 1 jour" })
      .max(365, { message: "L'essai ne peut pas dépasser 365 jours" })
      .optional()
  ),
  acceptTerms: z
    .literal(true, {
      message: "Vous devez accepter les CGU",
    })
    .refine((val) => val === true, { message: "Vous devez accepter les CGU" }),
});

export type SignupInput = z.infer<typeof signupSchema>;
