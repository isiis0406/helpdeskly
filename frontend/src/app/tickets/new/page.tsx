"use client"
import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ticketCreateSchema, type TicketCreateInput } from '@/lib/schemas/tickets'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FormProvider } from 'react-hook-form'
import { FormLabel, FormMessage } from '@/components/ui/form'

export default function NewTicketPage() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const methods = useForm<TicketCreateInput>({
    resolver: zodResolver(ticketCreateSchema),
    defaultValues: { status: 'OPEN', priority: 'MEDIUM' },
  })

  const { register, handleSubmit, formState: { errors } } = methods

  async function onSubmit(values: TicketCreateInput) {
    setError(null)
    const res = await fetch('/tickets/new', {
      method: 'POST',
      body: (() => { const fd = new FormData(); Object.entries(values).forEach(([k,v])=> fd.append(k, String(v ?? ''))); return fd })(),
    })
    if (!res.ok) {
      const data = await res.json().catch(()=>({}))
      throw new Error(data?.error || 'Création échouée')
    }
    const created = await res.json()
    const id = created?.id || created?.ticket?.id
    window.location.href = id ? `/tickets/${id}` : '/tickets'
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit((v)=> start(async ()=> { try { await onSubmit(v) } catch(e:any){ setError(e?.message||'Erreur inconnue') } }))}
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
          <div className="grid grid-cols-2 gap-3">
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

          {error && <div className="text-sm text-red-600">{error}</div>}
          <div>
            <Button disabled={pending}>{pending ? 'Création…' : 'Créer'}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
