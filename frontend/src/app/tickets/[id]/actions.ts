"use server"
import { revalidatePath } from 'next/cache'
import { apiPatch } from '@/lib/app-api'

export type ActionState = { ok?: boolean; error?: string }

function parseError(e: unknown): string {
  const msg = (e as any)?.message || 'Échec de la mise à jour'
  const m = /\{.*\}$/.exec(msg)
  if (m) {
    try {
      const j = JSON.parse(m[0])
      if (j?.message) return Array.isArray(j.message) ? j.message.join(', ') : String(j.message)
    } catch {}
  }
  return msg
}

export async function assignTicketAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('ticketId') || '')
  const assignedToId = String(formData.get('assignedToId') || '')
  if (!id || !assignedToId) return { ok: false, error: 'Sélection invalide' }
  try {
    await apiPatch(`/tickets/${id}/assign`, { assignedToId })
    revalidatePath(`/tickets/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: parseError(e) }
  }
}

export async function updateStatusAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('ticketId') || '')
  const status = String(formData.get('status') || '')
  if (!id || !status) return { ok: false, error: 'Statut invalide' }
  try {
    await apiPatch(`/tickets/${id}`, { status })
    revalidatePath(`/tickets/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: parseError(e) }
  }
}

export async function updatePriorityAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('ticketId') || '')
  const priority = String(formData.get('priority') || '')
  if (!id || !priority) return { ok: false, error: 'Priorité invalide' }
  try {
    await apiPatch(`/tickets/${id}`, { priority })
    revalidatePath(`/tickets/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: parseError(e) }
  }
}

