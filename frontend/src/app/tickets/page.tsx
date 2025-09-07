import { Sidebar } from "@/components/sidebar";
import { TenantPicker } from "@/components/tenant-picker";
import { apiGet } from "@/lib/app-api";
import { tPriority, tStatus } from "@/lib/i18n";
import { cookies } from "next/headers";
import Link from "next/link";
import { FiltersClient } from "./FiltersClient";
import { TicketsSectionClient } from "./TicketsSectionClient";
import { TicketsViewToggle } from "./TicketsViewToggle";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

type Ticket = {
  id: string;
  ticketNumber?: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
  assignedTo?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type Pagination = { page: number; limit: number; total: number; pages: number };
type TicketListResponse =
  | { data: Ticket[]; pagination?: Pagination }
  | Ticket[];

async function getTickets(filters: {
  q?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
  assignee?: string;
  page?: string;
  limit?: string;
}): Promise<{ items: Ticket[]; pagination?: Pagination }> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignedToId) params.set("assignedToId", filters.assignedToId);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.page) params.set("page", filters.page);
  if (filters.limit) params.set("limit", filters.limit);
  const qs = params.toString();
  const path = qs ? `/tickets?${qs}` : "/tickets";
  const res = await apiGet<TicketListResponse>(path);
  if (Array.isArray(res)) return { items: res };
  return { items: res?.data ?? [], pagination: res?.pagination };
}

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    assignedToId?: string;
    assignee?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const sp = (await searchParams) || {};
  const tenantSlug = (await cookies()).get("tenantSlug")?.value;
  const { items: tickets, pagination } = tenantSlug
    ? await getTickets(sp)
    : { items: [], pagination: undefined };
  const users = tenantSlug
    ? await apiGet<{ id: string; name?: string; email?: string }[]>(`/users`)
    : [];

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
        
        {/* Barre filtres + toggle de vue */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1">
            <FiltersClient initial={sp} users={users} />
          </div>
          <TicketsViewToggle />
        </div>
        <TicketsSectionClient items={tickets} pagination={pagination} />
      </div>
    </main>
  );
}

function BadgeStatus({
  value,
}: {
  value: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
}) {
  const label = tStatus(value);
  const cls =
    value === "OPEN"
      ? "bg-caribbean text-white"
      : value === "IN_PROGRESS"
      ? "bg-platinum text-jet"
      : value === "RESOLVED"
      ? "bg-green-600 text-white"
      : "bg-jet text-white";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}
    >
      {label}
    </span>
  );
}

function BadgePriority({
  value,
}: {
  value: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  const label = tPriority(value);
  const cls =
    value === "LOW"
      ? "bg-platinum text-jet"
      : value === "MEDIUM"
      ? "bg-caribbean text-white"
      : value === "HIGH"
      ? "bg-yellow-600 text-white"
      : "bg-red-600 text-white";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}
    >
      {label}
    </span>
  );
}

function Filters({
  initial,
}: {
  initial?: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    page?: string;
    limit?: string;
  };
}) {
  const q = initial?.q || "";
  const status = initial?.status || "";
  const priority = initial?.priority || "";
  const assignee = initial?.assignee || "";
  const limit = initial?.limit || "10";
  return (
    <form
      className="grid gap-2 md:grid-cols-[1fr_12rem_12rem_1fr_auto] items-end"
      action="/tickets"
      method="get"
    >
      <div>
        <label className="block text-sm mb-1">Recherche</label>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Titre, description..."
          className="w-full border border-border rounded px-3 py-2 bg-card"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Statut</label>
        <select
          name="status"
          defaultValue={status}
          className="w-full border border-border rounded px-3 py-2 bg-card"
        >
          <option value="">Tous</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Priorité</label>
        <select
          name="priority"
          defaultValue={priority}
          className="w-full border border-border rounded px-3 py-2 bg-card"
        >
          <option value="">Toutes</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Assigné (nom/email)</label>
        <input
          type="text"
          name="assignee"
          defaultValue={assignee}
          placeholder="ex: John"
          className="w-full border border-border rounded px-3 py-2 bg-card"
        />
      </div>
      <div className="flex items-center gap-2">
        <input type="hidden" name="limit" value={limit} />
        <button
          className="h-9 px-4 rounded bg-primary text-primary-foreground"
          type="submit"
        >
          Filtrer
        </button>
        <Link
          href="/tickets"
          className="h-9 px-4 rounded border border-border inline-flex items-center"
        >
          Réinitialiser
        </Link>
      </div>
    </form>
  );
}
