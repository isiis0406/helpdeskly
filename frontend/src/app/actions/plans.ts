"use server"
import { apiFetchServer } from '@/lib/api-server'
import { z } from 'zod'

const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
})
const PlansSchema = z.array(PlanSchema)

export async function getPlans() {
  // path WITHOUT version; version is handled globally
  return apiFetchServer('/plans', {}, PlansSchema).catch(() => [])
}
