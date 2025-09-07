"use client"
import { useActionState, useEffect } from 'react'
import { ActionState, assignTicketAction, updatePriorityAction, updateStatusAction } from './actions'
import { toast } from 'sonner'

type User = { id: string; name?: string; email?: string }

export function TicketActionsClient({
  ticketId,
  users,
  currentAssignedId,
  currentStatus,
  currentPriority,
}: {
  ticketId: string
  users: User[]
  currentAssignedId?: string | null
  currentStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  currentPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}) {
  const [assignState, assignAction, assignPending] = useActionState<ActionState, FormData>(assignTicketAction as any, {})
  const [statusState, statusAction, statusPending] = useActionState<ActionState, FormData>(updateStatusAction as any, {})
  const [prioState, prioAction, prioPending] = useActionState<ActionState, FormData>(updatePriorityAction as any, {})

  useEffect(() => {
    if (assignState?.error) toast.error(assignState.error)
    else if (assignState?.ok) toast.success('Ticket assigné')
  }, [assignState])
  useEffect(() => {
    if (statusState?.error) toast.error(statusState.error)
    else if (statusState?.ok) toast.success('Statut mis à jour')
  }, [statusState])
  useEffect(() => {
    if (prioState?.error) toast.error(prioState.error)
    else if (prioState?.ok) toast.success('Priorité mise à jour')
  }, [prioState])

  return (
    <div className="space-y-4">
      <form action={assignAction} className="grid gap-2 border rounded p-3">
        <input type="hidden" name="ticketId" value={ticketId} />
        <label className="text-sm">Affecté à</label>
        <select name="assignedToId" defaultValue={currentAssignedId || ''} className="border rounded px-2 py-1">
          <option value="">Non assigné</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email || u.id}
            </option>
          ))}
        </select>
        {assignState?.error && <div className="text-sm text-red-600">{assignState.error}</div>}
        <div>
          <button disabled={assignPending} className="h-9 px-3 rounded bg-blue-600 text-white disabled:opacity-60">
            {assignPending ? 'Mise à jour…' : 'Assigner'}
          </button>
        </div>
      </form>

      <form action={statusAction} className="grid gap-2 border rounded p-3">
        <input type="hidden" name="ticketId" value={ticketId} />
        <label className="text-sm">Statut</label>
        <select name="status" defaultValue={currentStatus} className="border rounded px-2 py-1">
          <option value="OPEN">Ouvert</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="RESOLVED">Résolu</option>
          <option value="CLOSED">Fermé</option>
        </select>
        {statusState?.error && <div className="text-sm text-red-600">{statusState.error}</div>}
        <div>
          <button disabled={statusPending} className="h-9 px-3 rounded border">
            {statusPending ? 'Mise à jour…' : 'Mettre à jour'}
          </button>
        </div>
      </form>

      <form action={prioAction} className="grid gap-2 border rounded p-3">
        <input type="hidden" name="ticketId" value={ticketId} />
        <label className="text-sm">Priorité</label>
        <select name="priority" defaultValue={currentPriority} className="border rounded px-2 py-1">
          <option value="LOW">Basse</option>
          <option value="MEDIUM">Moyenne</option>
          <option value="HIGH">Haute</option>
          <option value="URGENT">Urgente</option>
        </select>
        {prioState?.error && <div className="text-sm text-red-600">{prioState.error}</div>}
        <div>
          <button disabled={prioPending} className="h-9 px-3 rounded border">
            {prioPending ? 'Mise à jour…' : 'Mettre à jour'}
          </button>
        </div>
      </form>
    </div>
  )
}
