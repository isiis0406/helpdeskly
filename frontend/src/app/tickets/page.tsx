import { Sidebar } from "@/components/sidebar";
import { TenantPicker } from "@/components/tenant-picker";
import { apiGet } from "@/lib/app-api";
import { cookies } from "next/headers";
import Link from "next/link";
import { FiltersClient } from "./FiltersClient";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

type Ticket = {
  id: string;
  ticketNumber?: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
};

type TicketListResponse =
  | { data: Ticket[]; pagination?: { page: number; limit: number; total: number; pages: number } }
  | Ticket[];

async function getTickets(filters: { q?: string; status?: string; priority?: string; assignedToId?: string; page?: string; limit?: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignedToId) params.set("assignedToId", filters.assignedToId);
  if (filters.page) params.set("page", filters.page);
  if (filters.limit) params.set("limit", filters.limit);
  const qs = params.toString();
  const path = qs ? `/tickets?${qs}` : "/tickets";
  const res = await apiGet<TicketListResponse>(path);
  return Array.isArray(res) ? res : res?.data ?? [];
}

export default async function TicketsListPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; priority?: string; assignedToId?: string; page?: string; limit?: string }> }) {
  const sp = (await searchParams) || {};
  const tenantSlug = (await cookies()).get("tenantSlug")?.value;
  const tickets = tenantSlug ? await getTickets(sp) : [];
  const users = tenantSlug ? await apiGet<{ id: string; name?: string; email?: string }[]>(`/users`) : []

  return (
    <main className="container mx-auto p-6 grid md:grid-cols-[15rem_1fr] gap-6">
      <Sidebar />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Tickets</h1>
          <Link
            className="inline-flex items-center px-4 h-9 rounded bg-primary text-primary-foreground"
            href="/tickets/create"
          >
            Nouveau ticket
          </Link>
        </div>
        {!tenantSlug ? (
          <div className="bg-card border border-border rounded p-4">
            <div className="text-sm text-muted-foreground mb-2">
              Sélectionnez un tenant pour afficher les tickets.
            </div>
            <TenantPicker />
          </div>
        ) : (
          <>
            {/* Client filters for reactive UX */}
            <FiltersClient initial={sp} users={users} />
            <div className="overflow-x-auto bg-card border border-border rounded">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Priorité</th>
                    <th className="px-3 py-2">Créé</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(tickets) && tickets.length > 0 ? (
                    tickets.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border hover:bg-muted/40"
                      >
                        <td className="px-3 py-2">
                        <Link
                            className="text-accent underline-offset-4 hover:underline"
                            href={`/tickets/${t.id}`}
                          >
                            {(t.ticketNumber ? `${t.ticketNumber} — ` : "") +
                              t.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{t.status}</td>
                        <td className="px-3 py-2">{t.priority}</td>
                        <td className="px-3 py-2">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-4 text-muted-foreground"
                        colSpan={4}
                      >
                        Aucun ticket trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Filters({ initial }: { initial?: { q?: string; status?: string; priority?: string; assignee?: string; page?: string; limit?: string } }) {
  const q = initial?.q || ''
  const status = initial?.status || ''
  const priority = initial?.priority || ''
  const assignee = initial?.assignee || ''
  const limit = initial?.limit || '10'
  return (
    <form className="grid gap-2 md:grid-cols-[1fr_12rem_12rem_1fr_auto] items-end" action="/tickets" method="get">
      <div>
        <label className="block text-sm mb-1">Recherche</label>
        <input type="text" name="q" defaultValue={q} placeholder="Titre, description..." className="w-full border border-border rounded px-3 py-2 bg-card" />
      </div>
      <div>
        <label className="block text-sm mb-1">Statut</label>
        <select name="status" defaultValue={status} className="w-full border border-border rounded px-3 py-2 bg-card">
          <option value="">Tous</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Priorité</label>
        <select name="priority" defaultValue={priority} className="w-full border border-border rounded px-3 py-2 bg-card">
          <option value="">Toutes</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Assigné (nom/email)</label>
        <input type="text" name="assignee" defaultValue={assignee} placeholder="ex: John" className="w-full border border-border rounded px-3 py-2 bg-card" />
      </div>
      <div className="flex items-center gap-2">
        <input type="hidden" name="limit" value={limit} />
        <button className="h-9 px-4 rounded bg-primary text-primary-foreground" type="submit">Filtrer</button>
        <Link href="/tickets" className="h-9 px-4 rounded border border-border inline-flex items-center">Réinitialiser</Link>
      </div>
    </form>
  )
}
