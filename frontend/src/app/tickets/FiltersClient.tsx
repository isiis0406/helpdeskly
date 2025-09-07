"use client"
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
const STATUS_LABEL: Record<typeof STATUSES[number], string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
}
const PRIORITY_LABEL: Record<typeof PRIORITIES[number], string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
}

type User = { id: string; name?: string | null; email?: string | null }

export function FiltersClient({ initial, users }: { initial?: { q?: string; status?: string; priority?: string; assignedToId?: string; assignee?: string; page?: string; limit?: string }; users?: User[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [isPending, start] = useTransition()

  const [q, setQ] = useState(initial?.q || '')
  const [status, setStatus] = useState(initial?.status || '')
  const [priority, setPriority] = useState(initial?.priority || '')
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId || '')
  const [assignee, setAssignee] = useState(initial?.assignee || '')
  const limit = initial?.limit || '10'

  // Debounce for text search
  const debounce = (fn: (...args: any[]) => void, ms = 350) => {
    let t: any
    return (...args: any[]) => {
      clearTimeout(t)
      t = setTimeout(() => fn(...args), ms)
    }
  }

  const update = useCallback((next: Partial<Record<string, string>>) => {
    const params = new URLSearchParams(sp?.toString())
    Object.entries(next).forEach(([k, v]) => {
      if (v && v.length > 0) params.set(k, v)
      else params.delete(k)
    })
    // Reset page when filters change
    params.delete('page')
    start(() => router.replace(`${pathname}?${params.toString()}`))
  }, [router, pathname, sp])

  const onChangeQ = useMemo(() => debounce((value: string) => update({ q: value })), [update])
  const onChangeAssignee = useMemo(() => debounce((value: string) => update({ assignee: value })), [update])
  // no debounce for select

  useEffect(() => { onChangeQ(q) }, [q])

  return (
    <div className="grid gap-2 md:grid-cols-[1fr_12rem_12rem_1fr_1fr_auto] items-end">
      <div>
        <label className="block text-sm mb-1">Recherche</label>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Titre, description..." className="w-full border border-border rounded px-3 py-2 bg-card" />
      </div>
      <div>
        <label className="block text-sm mb-1">Statut</label>
        <select value={status} onChange={e=>{ setStatus(e.target.value); update({ status: e.target.value }) }} className="w-full border border-border rounded px-3 py-2 bg-card">
          <option value="">Tous</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Priorité</label>
        <select value={priority} onChange={e=>{ setPriority(e.target.value); update({ priority: e.target.value }) }} className="w-full border border-border rounded px-3 py-2 bg-card">
          <option value="">Toutes</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Assigné</label>
        <select value={assignedToId} onChange={e=>{ setAssignedToId(e.target.value); update({ assignedToId: e.target.value }) }} className="w-full border border-border rounded px-3 py-2 bg-card">
          <option value="">Tous</option>
          <option value="none">Aucun</option>
          {(users || []).map(u => (
            <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Assigné (nom/email)</label>
        <input value={assignee} onChange={e=>{ setAssignee(e.target.value); onChangeAssignee(e.target.value) }} placeholder="ex: John" className="w-full border border-border rounded px-3 py-2 bg-card" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{isPending ? 'Filtrage…' : ''}</span>
      </div>
    </div>
  )
}
