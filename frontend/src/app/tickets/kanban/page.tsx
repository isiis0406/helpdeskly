import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { cookies } from 'next/headers'
import { apiGet } from '@/lib/app-api'
import { KanbanClient } from './KanbanClient'

type Ticket = {
  id: string
  ticketNumber?: string
  title: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  createdAt: string
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
}

type TicketListResponse = { data: Ticket[] } | Ticket[]

async function getTicketsForKanban() {
  const res = await apiGet<TicketListResponse>('/tickets', { limit: 100 })
  return Array.isArray(res) ? res : (res?.data ?? [])
}

export default async function KanbanPage() {
  const tenantSlug = (await cookies()).get('tenantSlug')?.value
  const tickets = tenantSlug ? await getTicketsForKanban() : []
  return (
    <main className="container mx-auto p-6 grid md:grid-cols-[15rem_1fr] gap-6">
      <Sidebar />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Kanban</h1>
          <Link href="/tickets" className="text-sm underline">Vue liste</Link>
        </div>
        {!tenantSlug ? (
          <div className="text-sm text-muted-foreground">Sélectionnez un tenant.</div>
        ) : (
          <KanbanClient items={tickets} />
        )}
      </div>
    </main>
  )
}

