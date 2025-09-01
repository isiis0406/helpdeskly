import { apiFetchServer } from '@/lib/api-server'
import { cookies } from 'next/headers'
import TenantPickerSelect from './tenant-picker-select'

export default async function TenantMenu() {
  // Fetch profile to list memberships (tenants)
  const profile = await apiFetchServer('/auth/me').catch(() => null)
  const memberships = profile?.memberships || []
  const cookieStore = await cookies()
  const current = cookieStore.get('tenantSlug')?.value
  const options = memberships.map((m: any) => ({ slug: m.tenantSlug || m.tenant?.slug, name: m.tenantName || m.tenant?.name }))
  return <TenantPickerSelect options={options} current={current} />
}
