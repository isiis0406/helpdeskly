import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().regex(/^[a-z0-9-]+$/).optional().or(z.literal('')),
})

export type SignInInput = z.infer<typeof signInSchema>

