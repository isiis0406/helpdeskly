"use server"
import { cookies } from 'next/headers'

export async function setTenantSlugAction(slug: string) {
  const c = await cookies()
  c.set('tenantSlug', slug, { path: '/', httpOnly: false })
  return { ok: true }
}

export async function clearTenantSlugAction() {
  const c = await cookies()
  try {
    c.delete('tenantSlug')
  } catch {}
  // overwrite with expired cookie (safety for some runtimes)
  c.set('tenantSlug', '', { path: '/', maxAge: 0 })
  return { ok: true }
}
