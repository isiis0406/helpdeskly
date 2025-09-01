"use server"
import { apiFetchServer } from '@/lib/api-server'
import { z } from 'zod'

const SubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  billingCycle: z.string().optional(),
  plan: z.object({ id: z.string(), name: z.string().optional(), displayName: z.string().optional() }).optional(),
  amount: z.any().optional(),
})

export async function getCurrentSubscription() {
  // tenantSlug is inferred from cookie via apiFetchServer
  return apiFetchServer('/subscriptions/current', {}, z.any()).catch(() => null)
}

export async function changePlanAction(planId: string, billingCycle?: 'MONTHLY' | 'YEARLY') {
  return apiFetchServer('/subscriptions/plan', {
    method: 'PATCH',
    body: { planId, billingCycle },
  }, z.any())
}
