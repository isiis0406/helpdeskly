"use client"
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

function useDebouncedCallback(cb: (...args: any[]) => void, delay: number) {
  const [t, setT] = useState<any>(null)
  return useCallback((...args: any[]) => {
    if (t) clearTimeout(t)
    const nt = setTimeout(() => cb(...args), delay)
    setT(nt)
  }, [cb, delay, t])
}

export default function FiltersClient({
  initial: { q, status, priority, assigned, assignee },
}: {
  initial: { q?: string; status?: string; priority?: string; assigned?: string; assignee?: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [state, setState] = useState({
    q: q || '',
    status: status || '',
    priority: priority || '',
    assigned: assigned || '',
    assignee: assignee || '',
  })

  const apply = useDebouncedCallback((s: typeof state) => {
    const usp = new URLSearchParams(params?.toString() || '')
    Object.entries(s).forEach(([k, v]) => {
      if (v) usp.set(k, v)
      else usp.delete(k)
    })
    router.replace(`${pathname}?${usp.toString()}`)
  }, 300)

  useEffect(() => {
    apply(state)
  }, [state])

  return (
    <div className="flex gap-3 items-end">
      <div className="grid">
        <label className="text-sm">Recherche</label>
        <input className="border rounded px-2 py-1" value={state.q} onChange={(e)=> setState(s=>({...s,q:e.target.value}))} placeholder="Titre, description, #..." />
      </div>
      <div className="grid">
        <label className="text-sm">Assigné (nom ou email)</label>
        <input className="border rounded px-2 py-1" value={state.assignee} onChange={(e)=> setState(s=>({...s,assignee:e.target.value}))} placeholder="nom ou email" />
      </div>
      <div className="grid">
        <label className="text-sm">Statut</label>
        <select className="border rounded px-2 py-1" value={state.status} onChange={(e)=> setState(s=>({...s,status:e.target.value}))}>
          <option value="">Tous</option>
          <option value="OPEN">Ouvert</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="RESOLVED">Résolu</option>
          <option value="CLOSED">Fermé</option>
        </select>
      </div>
      <div className="grid">
        <label className="text-sm">Priorité</label>
        <select className="border rounded px-2 py-1" value={state.priority} onChange={(e)=> setState(s=>({...s,priority:e.target.value}))}>
          <option value="">Toutes</option>
          <option value="LOW">Basse</option>
          <option value="MEDIUM">Moyenne</option>
          <option value="HIGH">Haute</option>
          <option value="URGENT">Urgente</option>
        </select>
      </div>
      <div className="grid">
        <label className="text-sm">
          <input type="checkbox" className="mr-2" checked={state.assigned==='me'} onChange={(e)=> setState(s=>({...s,assigned: e.target.checked ? 'me' : ''}))} />
          Assignés à moi
        </label>
      </div>
    </div>
  )
}

