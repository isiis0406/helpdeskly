import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { apiGet, apiPost } from '@/lib/app-api'
import { TicketActionsClient } from './TicketActionsClient'

type TicketUser = { id: string; name?: string; email?: string }
type Comment = { id: string; body: string; author?: TicketUser; createdAt: string }
type Ticket = {
  id: string
  ticketNumber?: string
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
        <div>
          <div className="text-xs text-muted-foreground">Ticket</div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {ticket.ticketNumber && (
              <span className="inline-flex items-center rounded bg-platinum px-2 py-0.5 text-xs text-jet">
                {ticket.ticketNumber}
              </span>
            )}
            {ticket.title}
          </h1>
        </div>
        <Link className="text-sm underline text-primary" href="/tickets">Retour</Link>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-3 space-y-4">
          <div className="border border-border rounded p-4 bg-card">
            <h2 className="font-medium mb-2">Description</h2>
            <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
          </div>
          <div className="border border-border rounded p-4 bg-card">
            <h2 className="font-medium mb-3">Commentaires</h2>
            <CommentForm ticketId={ticket.id} />
            <div className="mt-4 space-y-3">
              {ticket.comments?.map((c) => (
                <div key={c.id} className="rounded border border-border p-3 bg-card">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar user={c.author} />
                    <span>{c.author?.name || c.author?.email || 'Utilisateur'}</span>
                    <span className="text-muted-foreground/70">•</span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-sm mt-2 whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              {(!ticket.comments || ticket.comments.length === 0) && (
                <div className="text-sm text-muted-foreground">Aucun commentaire</div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="border border-border rounded p-4 text-sm bg-card space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Statut:</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-platinum text-jet text-xs">{ticket.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Priorité:</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-platinum text-jet text-xs">{ticket.priority}</span>
            </div>
            <div><span className="text-muted-foreground">Auteur:</span> {ticket.author?.name || ticket.author?.email}</div>
            <div><span className="text-muted-foreground">Assigné à:</span> {ticket.assignedTo?.name || ticket.assignedTo?.email || '-'}</div>
            <div><span className="text-muted-foreground">Créé:</span> {new Date(ticket.createdAt).toLocaleString()}</div>
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
      <textarea name="body" rows={3} className="border border-border rounded p-2 text-sm bg-card" placeholder="Ajouter un commentaire..." />
      <div>
        <button className="px-3 h-9 rounded bg-primary text-primary-foreground">Publier</button>
      </div>
    </form>
  )
}

function Avatar({ user, size=24 }: { user?: TicketUser; size?: number }) {
  const name = user?.name || user?.email || 'Utilisateur'
  const initials = (name || '?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()
  return (
    <div style={{width:size,height:size}} className="inline-flex items-center justify-center rounded-full bg-platinum text-jet text-xs font-medium">
      {initials}
    </div>
  )
}
