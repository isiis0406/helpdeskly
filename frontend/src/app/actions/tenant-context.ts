"use server"
import { cookies } from 'next/headers'

export async function setTenantSlugAction(slug: string) {
  const c = cookies()
  c.set('tenantSlug', slug, { path: '/', httpOnly: false })
  return { ok: true }
}
