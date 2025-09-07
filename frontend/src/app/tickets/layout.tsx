import { auth } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || (session as any).error) {
    redirect('/auth/sign-in')
  }
  return <>{children}</>
}

