import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string({ message: "L'email est requis" })
    .min(1, "L'email est requis")
    .email("Email invalide"),
  password: z
    .string({ message: "Le mot de passe est requis" })
    .min(1, "Le mot de passe est requis"),
  tenantSlug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"
    )
    .min(2, "Le slug doit contenir au moins 2 caractères")
    .max(50, "Le slug ne peut pas dépasser 50 caractères")
    .optional()
    .or(z.literal("")),
});

export type SignInInput = z.infer<typeof signInSchema>;
