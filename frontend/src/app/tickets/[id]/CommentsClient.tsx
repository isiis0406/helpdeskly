"use client"
import { useState } from 'react'
import { apiDelete, apiPatch } from '@/lib/app-api'
import { toast } from 'sonner'

type TicketUser = { id: string; name?: string | null; email?: string | null }
type Comment = { id: string; body: string; author?: TicketUser; authorId?: string; createdAt: string }

export function CommentsClient({ ticketId, items, currentUserId }: { ticketId: string; items: Comment[]; currentUserId?: string }) {
  const [comments, setComments] = useState(items)

  async function doDelete(id: string) {
    try {
      await apiDelete(`/tickets/${ticketId}/comments/${id}`)
      setComments(prev => prev.filter(c => c.id !== id))
      toast.success('Commentaire supprimé')
    } catch (e:any) {
      toast.error(e?.message || 'Suppression impossible')
    }
  }

  async function doSave(id: string, body: string) {
    try {
      const updated = await apiPatch<Comment>(`/tickets/${ticketId}/comments/${id}`, { body })
      setComments(prev => prev.map(c => c.id === id ? updated : c))
      toast.success('Commentaire modifié')
    } catch (e:any) {
      toast.error(e?.message || 'Modification impossible')
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {comments.map(c => (
        <CommentRow key={c.id} c={c} canEdit={!!currentUserId && (c.authorId === currentUserId)} onDelete={doDelete} onSave={doSave} />
      ))}
      {comments.length === 0 && (
        <div className="text-sm text-muted-foreground">Aucun commentaire</div>
      )}
    </div>
  )
}

function CommentRow({ c, canEdit, onDelete, onSave }: { c: Comment; canEdit: boolean; onDelete: (id:string)=>void; onSave:(id:string, body:string)=>void }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(c.body)
  const name = c.author?.name || c.author?.email || 'Utilisateur'
  const initials = (name || '?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()
  return (
    <div className="rounded border border-border p-3 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="inline-flex items-center justify-center rounded-full bg-platinum text-jet w-6 h-6">
          {initials}
        </div>
        <span>{name}</span>
        <span className="text-muted-foreground/70">•</span>
        <span>{new Date(c.createdAt).toLocaleString()}</span>
        {canEdit && !editing && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={()=>setEditing(true)} className="h-7 px-2 rounded border border-border text-xs">Éditer</button>
            <button onClick={()=>onDelete(c.id)} className="h-7 px-2 rounded border border-border text-xs">Supprimer</button>
          </div>
        )}
      </div>
      <div className="text-sm mt-2 whitespace-pre-wrap">
        {editing ? (
          <div className="space-y-2">
            <textarea className="w-full border border-border rounded p-2 bg-card" rows={3} value={body} onChange={e=>setBody(e.target.value)} />
            <div className="flex items-center gap-2">
              <button onClick={()=>{ onSave(c.id, body); setEditing(false) }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs">Enregistrer</button>
              <button onClick={()=>{ setEditing(false); setBody(c.body) }} className="h-8 px-3 rounded border border-border text-xs">Annuler</button>
            </div>
          </div>
        ) : (
          c.body
        )}
      </div>
    </div>
  )
}

