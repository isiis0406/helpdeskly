import { z } from "zod";

export const ticketCreateSchema = z.object({
  title: z
    .string({ message: "Le titre est requis" })
    .min(3, { message: "Le titre doit contenir au moins 3 caractères" })
    .max(200, { message: "Le titre ne peut pas dépasser 200 caractères" }),
  description: z.string({ message: "La description est requise" }).min(10, {
    message: "La description doit contenir au moins 10 caractères",
  }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"], {
    message: "La priorité est requise",
  }),
  category: z.enum(
    ["TECHNICAL", "BILLING", "FEATURE_REQUEST", "BUG_REPORT", "ACCOUNT", "OTHER"],
    { message: "La catégorie est requise" }
  ),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], {
    message: "Le statut est requis",
  }),
  assignedToId: z.string().min(1).optional(),
  tags: z
    .string()
    .max(500, { message: "Les tags ne peuvent pas dépasser 500 caractères" })
    .optional(),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
