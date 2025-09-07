"use server"
import { cookies } from 'next/headers'
import { buildAppApiUrl } from '@/lib/env'
import { auth } from '@/app/api/auth/[...nextauth]/route'

function decodeJwtPayload(token?: string): any | null {
  try {
    if (!token) return null
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function isValidSlug(slug?: string): slug is string {
  return !!slug && /^[a-z0-9-]{2,50}$/.test(slug)
}

async function authHeaders() {
  const session = await auth()
  const c = await cookies()
  let tenantSlug = c.get('tenantSlug')?.value

  // Fallback: extraire le slug du JWT d'accès si présent
  if (!isValidSlug(tenantSlug) && session && (session as any).accessToken) {
    const payload = decodeJwtPayload((session as any).accessToken as string)
    tenantSlug = payload?.currentTenantSlug || payload?.tenantSlug || undefined
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session && (session as any).accessToken) {
    headers['Authorization'] = `Bearer ${(session as any).accessToken}`
  }
  if (isValidSlug(tenantSlug)) {
    headers['X-Tenant-Slug'] = tenantSlug
  }
  return headers
}

export async function apiFetch<T = any>(
  path: string,
  options: { method?: HttpMethod; body?: any; searchParams?: Record<string, any> } = {}
): Promise<T> {
  const method = options.method ?? 'GET'
  const url = new URL(buildAppApiUrl(path))
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    })
  }
  const headers = await authHeaders()
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${method} ${url.pathname} failed: ${res.status} ${text}`)
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T
  return (await res.json()) as T
}

export async function apiGet<T = any>(path: string, searchParams?: Record<string, any>) {
  return apiFetch<T>(path, { method: 'GET', searchParams })
}

export async function apiPost<T = any>(path: string, body?: any) {
  return apiFetch<T>(path, { method: 'POST', body })
}

export async function apiPatch<T = any>(path: string, body?: any) {
  return apiFetch<T>(path, { method: 'PATCH', body })
}

export async function apiDelete<T = any>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' })
}
