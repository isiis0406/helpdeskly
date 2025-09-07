import Link from 'next/link'
import { LayoutDashboard, Ticket, CreditCard } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground hidden md:block">
      <div className="h-14 px-4 flex items-center font-semibold">Helpdeskly</div>
      <nav className="px-2 py-3 text-sm space-y-1">
        <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground">
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </Link>
        <Link href="/tickets" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground">
          <Ticket className="w-4 h-4" /> Tickets
        </Link>
        <Link href="/billing/plan" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground">
          <CreditCard className="w-4 h-4" /> Mon plan
        </Link>
      </nav>
    </aside>
  )
}

