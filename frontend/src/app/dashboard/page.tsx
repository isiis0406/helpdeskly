import { auth } from '@/app/api/auth/[...nextauth]/route'
import Link from 'next/link'
import { getPlans } from '@/app/actions/plans'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    return (
      <main className="container mx-auto p-6">
        <p>Veuillez vous <Link className="text-primary underline" href="/auth/sign-in">connecter</Link>.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-6 grid md:grid-cols-[15rem_1fr] gap-6">
      <Sidebar />
      <div>
        <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-card border border-border rounded p-4">
            <h2 className="font-medium mb-2">Session</h2>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">{JSON.stringify(session, null, 2)}</pre>
          </section>
          <section className="bg-card border border-border rounded p-4">
            <h2 className="font-medium mb-2">Plans</h2>
            <PlansList />
          </section>
        </div>
      </div>
    </main>
  )
}

async function PlansList() {
  const plans = await getPlans()
  return (
    <ul className="space-y-2">
      {Array.isArray(plans) && plans.length > 0 ? (
        plans.map((p: any) => (
          <li key={p.id} className="border border-border rounded p-3 bg-card">
            <div className="font-medium">{p.displayName || p.name}</div>
            <div className="text-sm text-muted-foreground">{p.description}</div>
          </li>
        ))
      ) : (
        <li className="text-sm text-muted-foreground">Aucun plan trouvé.</li>
      )}
    </ul>
  )
}
