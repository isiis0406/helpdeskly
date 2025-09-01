"use client"
import { useTransition } from 'react'
import { setTenantSlugAction } from '@/app/actions/tenant-context'

export default function TenantPickerSelect({ options, current }: { options: { slug: string; name?: string }[]; current?: string }) {
  const [isPending, start] = useTransition()
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    start(async () => {
      await setTenantSlugAction(e.target.value)
      window.location.reload()
    })
  }
  return (
    <select defaultValue={current || ''} onChange={onChange} className="border border-border bg-card text-fg rounded px-2 py-1 text-sm min-w-[180px]">
      <option value="" disabled>
        {isPending ? 'Mise à jour…' : 'Sélectionner un tenant'}
      </option>
      {options.filter(o=>!!o.slug).map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.name || o.slug}
        </option>
      ))}
    </select>
  )
}
