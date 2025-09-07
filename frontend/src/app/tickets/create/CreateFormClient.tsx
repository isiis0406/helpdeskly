"use client"
import { useActionState, useState, useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ticketCreateSchema, type TicketCreateInput } from '@/lib/schemas/tickets'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FormLabel, FormMessage } from '@/components/ui/form'
import { createTicketAction, type CreateTicketFormState } from './actions'
import { toast } from 'sonner'

type UserOption = { id: string; name?: string | null; email?: string | null }

export function CreateFormClient({ users, currentUserId }: { users: UserOption[]; currentUserId?: string }) {
  const [error, setError] = useState<string | null>(null)
  const methods = useForm<TicketCreateInput>({
    resolver: zodResolver(ticketCreateSchema),
    defaultValues: { status: 'OPEN', priority: 'MEDIUM', category: 'TECHNICAL', assignedToId: currentUserId || '' },
  })

  const { register, formState: { errors }, trigger } = methods
  const [state, formAction, isSubmitting] = useActionState<CreateTicketFormState, FormData>(createTicketAction as any, {})

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state?.error])

  return (
    <FormProvider {...methods}>
      <form
        action={formAction}
        onSubmit={async (e)=> {
          setError(null)
          const ok = await trigger()
          if (!ok) {
            e.preventDefault()
            return
          }
        }}
        className="grid gap-3 max-w-2xl"
      >
        <div className="grid gap-1">
          <FormLabel>Titre</FormLabel>
          <Input {...register('title')} />
          <FormMessage>{errors.title?.message}</FormMessage>
        </div>
        <div className="grid gap-1">
          <FormLabel>Description</FormLabel>
          <Textarea rows={6} {...register('description')} />
          <FormMessage>{errors.description?.message}</FormMessage>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1">
            <FormLabel>Priorité</FormLabel>
            <select className="border rounded px-2 py-1" defaultValue="MEDIUM" {...register('priority')}>
              <option value="LOW">Basse</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="HIGH">Haute</option>
              <option value="URGENT">Urgente</option>
            </select>
            <FormMessage>{errors.priority?.message}</FormMessage>
          </div>
          <div className="grid gap-1">
            <FormLabel>Catégorie</FormLabel>
            <select className="border rounded px-2 py-1" defaultValue="TECHNICAL" {...register('category')}>
              <option value="TECHNICAL">Technique</option>
              <option value="BILLING">Facturation</option>
              <option value="FEATURE_REQUEST">Demande de fonctionnalité</option>
              <option value="BUG_REPORT">Rapport de bug</option>
              <option value="ACCOUNT">Compte</option>
              <option value="OTHER">Autre</option>
            </select>
            <FormMessage>{errors.category?.message}</FormMessage>
          </div>
          <div className="grid gap-1">
            <FormLabel>Statut</FormLabel>
            <select className="border rounded px-2 py-1" defaultValue="OPEN" {...register('status')}>
              <option value="OPEN">Ouvert</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="RESOLVED">Résolu</option>
              <option value="CLOSED">Fermé</option>
            </select>
            <FormMessage>{errors.status?.message}</FormMessage>
          </div>
        </div>

        <div className="grid gap-1">
          <FormLabel>Affecté à</FormLabel>
          <select className="border rounded px-2 py-1" defaultValue="" {...register('assignedToId')}>
            <option value="">Non assigné</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id}
              </option>
            ))}
          </select>
          <FormMessage>{errors.assignedToId?.message}</FormMessage>
        </div>

        <div className="grid gap-1">
          <FormLabel>Tags (séparés par des virgules)</FormLabel>
          <Input placeholder="connexion,urgent" {...register('tags')} />
          <FormMessage>{errors.tags?.message}</FormMessage>
        </div>

        {(state?.error || error) && <div className="text-sm text-red-600">{state?.error || error}</div>}
        <div>
          <Button disabled={isSubmitting}>{isSubmitting ? 'Création…' : 'Créer'}</Button>
        </div>
      </form>
    </FormProvider>
  )
}
