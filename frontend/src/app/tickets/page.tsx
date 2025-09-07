import Link from 'next/link'
import { apiGet } from '@/lib/app-api'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { decodeJwtPayload } from '@/lib/jwt'
import FiltersClient from './FiltersClient'

type TicketUser = { id: string; name?: string; email?: string }
type Ticket = {
  id: string
  ticketNumber?: string
  title: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  author?: TicketUser
  assignedTo?: TicketUser | null
  createdAt: string
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const page = Number(sp.page || '1') || 1
  const limit = Number(sp.limit || '10') || 10
  const status = sp.status || undefined
  const priority = sp.priority || undefined
  const q = sp.q || ''
  const assignee = sp.assignee || ''
  const assigned = sp.assigned || undefined

  const session = await auth()
  const currentUserId = decodeJwtPayload((session as any)?.accessToken)?.sub as string | undefined

  let data: { data: Ticket[]; pagination: { page: number; pages: number; total: number } }
  try {
    data = await apiGet('/tickets', {
      page,
      limit,
      status,
      priority,
      q: q || undefined,
      assignee: assignee || undefined,
      assignedToId: assigned === 'me' && currentUserId ? currentUserId : undefined,
    })
  } catch (e: any) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Tickets</h1>
        <p className="text-sm text-red-600">Impossible de joindre l'API des tickets. Vérifiez que l'App API est démarrée sur {process.env.NEXT_PUBLIC_APP_API_URL || 'http://localhost:6501'}.</p>
        <p className="text-xs text-gray-500 mt-2">{e?.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <Link className="inline-flex items-center px-4 py-2 rounded bg-blue-600 text-white" href="/tickets/create">
          Nouveau ticket
        </Link>
      </div>

      <FiltersClient initial={{ q, status, priority, assigned, assignee }} />

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Titre</th>
              <th className="text-left p-2">Statut</th>
              <th className="text-left p-2">Priorité</th>
              <th className="text-left p-2">Assigné à</th>
              <th className="text-left p-2">Créé</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((t) => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-2">{t.ticketNumber || '-'}</td>
                <td className="p-2">
                  <Link href={`/tickets/${t.id}`} className="text-blue-700 hover:underline">
                    {t.title}
                  </Link>
                </td>
                <td className="p-2">{t.status}</td>
                <td className="p-2">{t.priority}</td>
                <td className="p-2">{t.assignedTo?.name || t.assignedTo?.email || '-'}</td>
                <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          Page {data.pagination.page} / {data.pagination.pages} — {data.pagination.total} tickets
        </span>
      </div>
    </div>
  )
}
