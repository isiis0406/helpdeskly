"use server"
import { redirect } from 'next/navigation'
import { apiPost } from '@/lib/app-api'

export type CreateTicketFormState = { ok?: boolean; error?: string }

function parseApiErrorMessage(err: unknown): string {
  const msg = (err as any)?.message || 'Échec de la création'
  const match = /\{.*\}$/.exec(msg)
  if (match) {
    try {
      const j = JSON.parse(match[0])
      if (j?.message) return Array.isArray(j.message) ? j.message.join(', ') : String(j.message)
    } catch {}
  }
  return msg
}

export async function createTicketAction(prev: CreateTicketFormState, formData: FormData): Promise<CreateTicketFormState> {
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const priority = String(formData.get('priority') || 'MEDIUM')
  const status = String(formData.get('status') || 'OPEN')
  const category = String(formData.get('category') || 'TECHNICAL')
  const tags = formData.get('tags') ? String(formData.get('tags')) : undefined
  const assignedToId = formData.get('assignedToId') ? String(formData.get('assignedToId')) : undefined

  if (!title || !description) {
    return { ok: false, error: 'Veuillez remplir les champs requis' }
  }

  try {
    const created: any = await apiPost('/tickets', { title, description, priority, status, category, tags, assignedToId })
    const id = created?.id || created?.ticket?.id
    redirect(id ? `/tickets/${id}` : '/tickets')
  } catch (e) {
    return { ok: false, error: parseApiErrorMessage(e) }
  }
}
