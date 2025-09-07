import { Sidebar } from "@/components/sidebar";
import { TenantPicker } from "@/components/tenant-picker";
import { apiGet } from "@/lib/app-api";
import { cookies } from "next/headers";
import Link from "next/link";

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

async function getTickets(q: string | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const qs = params.toString();
  const path = qs ? `/tickets?${qs}` : "/tickets";
  const res = await apiGet<TicketListResponse>(path);
  return Array.isArray(res) ? res : res?.data ?? [];
}

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const { q } = (await searchParams) || {};
  const tenantSlug = (await cookies()).get("tenantSlug")?.value;
  const tickets = tenantSlug ? await getTickets(q) : [];

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
            <SearchBar initial={q} />
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
                            className="text-primary underline-offset-4 hover:underline"
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

function SearchBar({ initial }: { initial?: string }) {
  const q = initial || "";
  return (
    <form className="flex items-center gap-2" action="/tickets" method="get">
      <input
        type="text"
        name="q"
        defaultValue={q}
        placeholder="Rechercher un ticket..."
        className="w-full md:max-w-md border border-border rounded px-3 py-2 bg-card"
      />
      <button className="h-9 px-4 rounded border border-border" type="submit">
        Rechercher
      </button>
    </form>
  );
}
