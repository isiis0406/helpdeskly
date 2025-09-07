import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { apiGet, apiPost } from '@/lib/app-api'
import { TicketActionsClient } from './TicketActionsClient'

type TicketUser = { id: string; name?: string; email?: string }
type Comment = { id: string; body: string; author?: TicketUser; createdAt: string }
type Ticket = {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  author?: TicketUser
  assignedTo?: TicketUser | null
  comments?: Comment[]
  createdAt: string
}

async function getTicket(id: string) {
  return apiGet<Ticket>(`/tickets/${id}`)
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Rien: le flux de création utilise désormais /tickets/create
  const ticket = await getTicket(id)
  const users = await apiGet<{ id: string; name?: string; email?: string }[]>('/users')
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{ticket.title}</h1>
        <Link className="text-sm underline" href="/tickets">Retour à la liste</Link>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-3 space-y-4">
          <div className="border rounded p-4">
            <h2 className="font-medium mb-2">Description</h2>
            <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
          </div>
          <div className="border rounded p-4">
            <h2 className="font-medium mb-3">Commentaires</h2>
            <CommentForm ticketId={ticket.id} />
            <div className="mt-4 space-y-3">
              {ticket.comments?.map((c) => (
                <div key={c.id} className="rounded border p-3">
                  <div className="text-xs text-gray-600">
                    {c.author?.name || c.author?.email || 'Utilisateur'} — {new Date(c.createdAt).toLocaleString()}
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              {(!ticket.comments || ticket.comments.length === 0) && (
                <div className="text-sm text-gray-500">Aucun commentaire</div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="border rounded p-4 text-sm">
            <div><span className="text-gray-500">Statut:</span> {ticket.status}</div>
            <div><span className="text-gray-500">Priorité:</span> {ticket.priority}</div>
            <div><span className="text-gray-500">Auteur:</span> {ticket.author?.name || ticket.author?.email}</div>
            <div><span className="text-gray-500">Assigné à:</span> {ticket.assignedTo?.name || ticket.assignedTo?.email || '-'}</div>
            <div><span className="text-gray-500">Créé:</span> {new Date(ticket.createdAt).toLocaleString()}</div>
          </div>

          <TicketActionsClient
            ticketId={ticket.id}
            users={users}
            currentAssignedId={(ticket as any).assignedToId || undefined}
            currentStatus={ticket.status}
            currentPriority={ticket.priority}
          />
        </div>
      </div>
    </div>
  )
}

async function addCommentAction(formData: FormData) {
  'use server'
  const ticketId = String(formData.get('ticketId') || '')
  const body = String(formData.get('body') || '').trim()
  if (!ticketId) return
  if (!body) return
  await apiPost(`/tickets/${ticketId}/comments`, { body })
  revalidatePath(`/tickets/${ticketId}`)
}

function CommentForm({ ticketId }: { ticketId: string }) {
  return (
    <form action={addCommentAction} className="grid gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea name="body" rows={3} className="border rounded p-2 text-sm" placeholder="Ajouter un commentaire..." />
      <div>
        <button className="px-3 h-9 rounded bg-blue-600 text-white">Publier</button>
      </div>
    </form>
  )
}
