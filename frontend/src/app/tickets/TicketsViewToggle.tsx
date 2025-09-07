"use client"
import { useEffect, useState } from 'react'
import { List, Kanban } from 'lucide-react'

export function TicketsViewToggle() {
  const [view, setView] = useState<'list'|'kanban'>('list')
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ticketsView') as 'list'|'kanban'|null
      if (stored) setView(stored)
    } catch {}
  }, [])
  function set(v: 'list'|'kanban') {
    setView(v)
    try { localStorage.setItem('ticketsView', v) } catch {}
    window.dispatchEvent(new CustomEvent('tickets:view-changed', { detail: v }))
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={()=>set('list')} className={`h-9 w-9 inline-flex items-center justify-center rounded border ${view==='list' ? 'bg-primary text-primary-foreground border-transparent' : 'border-border text-muted-foreground'}`} title="Vue liste">
        <List className="h-4 w-4" />
      </button>
      <button onClick={()=>set('kanban')} className={`h-9 w-9 inline-flex items-center justify-center rounded border ${view==='kanban' ? 'bg-primary text-primary-foreground border-transparent' : 'border-border text-muted-foreground'}`} title="Vue kanban">
        <Kanban className="h-4 w-4" />
      </button>
    </div>
  )
}

