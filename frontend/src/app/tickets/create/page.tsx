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
      <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
      <CreateFormClient users={users} currentUserId={currentUserId} />
    </div>
  )
}
