import { apiGet } from '@/lib/app-api'
import { CreateFormClient } from './CreateFormClient'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { decodeJwtPayload } from '@/lib/jwt'

export default async function NewTicketPage() {
  const users = await apiGet<{ id: string; name?: string; email?: string }[]>('/users')
  const session = await auth()
  const currentUserId = decodeJwtPayload((session as any)?.accessToken)?.sub as string | undefined
  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-xs text-muted-foreground">Tickets</div>
        <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
        <p className="text-sm text-muted-foreground mt-1">Renseignez le titre, la description et assignez un agent.</p>
      </div>
      <div className="bg-card border border-border rounded p-4 max-w-3xl">
        <CreateFormClient users={users} currentUserId={currentUserId} />
      </div>
    </div>
  )
}
