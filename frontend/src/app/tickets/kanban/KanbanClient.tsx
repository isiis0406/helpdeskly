"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiPatch } from '@/lib/app-api'
import { BadgePriority, BadgeStatus } from '@/components/badges'

type Ticket = {
  id: string
  ticketNumber?: string
  title: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  createdAt: string
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
}

const COLUMNS: { key: Ticket['status']; title: string }[] = [
  { key: 'OPEN', title: 'Ouvert' },
  { key: 'IN_PROGRESS', title: 'En cours' },
  { key: 'RESOLVED', title: 'Résolu' },
  { key: 'CLOSED', title: 'Fermé' },
]

export function KanbanClient({ items, currentUserId }: { items: Ticket[]; currentUserId?: string }) {
  const [tickets, setTickets] = useState(items)
  const [hoverCol, setHoverCol] = useState<Ticket['status'] | null>(null)

  useEffect(() => setTickets(items), [items])

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function onDrop(e: React.DragEvent, status: Ticket['status']) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    try {
      await apiPatch(`/tickets/${id}`, { status })
    } catch {
      // rollback on error
      setTickets(items)
    }
  }

  const grouped = useMemo(() => {
    const m: Record<Ticket['status'], Ticket[]> = {
      OPEN: [], IN_PROGRESS: [], RESOLVED: [], CLOSED: []
    }
    for (const t of tickets) m[t.status].push(t)
    return m
  }, [tickets])

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {COLUMNS.map(col => (
        <div key={col.key} className="rounded border border-border bg-card flex flex-col h-[75vh]">
          {/* Column header (status on top) */}
          <div className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-3 py-2 flex items-center justify-between">
            <div className="font-medium">{col.title}</div>
            <div className="text-xs text-muted-foreground">{grouped[col.key].length}</div>
          </div>
          {/* Cards container (bottom) */}
          <div
            className={`flex-1 overflow-auto p-3 space-y-2 transition-colors ${hoverCol === col.key ? 'ring-1 ring-accent rounded-md' : ''}`}
            onDragOver={allowDrop}
            onDrop={(e)=>{ setHoverCol(null); onDrop(e, col.key) }}
            onDragEnter={()=>setHoverCol(col.key)}
            onDragLeave={()=>setHoverCol(null)}
          >
            {grouped[col.key].map(t => {
              const canDrag = !!currentUserId && (t.assignedTo?.id === currentUserId)
              return (
              <div key={t.id} draggable={canDrag} onDragStart={(e)=> canDrag && onDragStart(e, t.id)}
                   title={canDrag ? undefined : 'Non assigné à vous'}
                   className={`rounded border border-border bg-background p-3 ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-90'} shadow-sm hover:shadow`}>
                <div className="text-xs text-muted-foreground mb-1">
                  <Link className="underline underline-offset-4 text-accent" href={`/tickets/${t.id}`}>{t.ticketNumber}</Link>
                </div>
                <div className="font-medium text-sm mb-1 line-clamp-2">
                  <Link className="hover:underline" href={`/tickets/${t.id}`}>{t.title}</Link>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <BadgeStatus value={t.status} />
                  <BadgePriority value={t.priority} />
                  <span className="ml-auto text-muted-foreground">{t.assignedTo?.name || t.assignedTo?.email || '—'}</span>
                </div>
              </div>
            )})}
            {grouped[col.key].length === 0 && (
              <div className="text-xs text-muted-foreground">Déposez ici</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
