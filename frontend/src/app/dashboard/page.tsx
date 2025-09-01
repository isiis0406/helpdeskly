import { auth } from '@/app/api/auth/[...nextauth]/route'
import Link from 'next/link'
import { getPlans } from '@/app/actions/plans'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    return (
      <main className="container mx-auto p-6">
        <p>Veuillez vous <Link className="text-blue-600 underline" href="/auth/sign-in">connecter</Link>.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-medium mb-2">Session</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">{JSON.stringify(session, null, 2)}</pre>
        </section>
        <section>
          <h2 className="font-medium mb-2">Plans</h2>
          <PlansList />
        </section>
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
          <li key={p.id} className="border rounded p-3">
            <div className="font-medium">{p.displayName || p.name}</div>
            <div className="text-sm text-gray-600">{p.description}</div>
          </li>
        ))
      ) : (
        <li className="text-sm text-gray-600">Aucun plan trouvé.</li>
      )}
    </ul>
  )
}
