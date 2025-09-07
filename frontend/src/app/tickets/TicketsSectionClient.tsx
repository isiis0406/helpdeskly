"use client";
import { BadgePriority, BadgeStatus } from "@/components/badges";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { KanbanClient } from "./kanban/KanbanClient";

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

export function TicketsSectionClient({
  items,
  pagination,
  currentUserId,
}: {
  items: Ticket[];
  pagination?: Pagination;
  currentUserId?: string;
}) {
  const [view, setView] = useState<"list" | "kanban">("list");
  const sp = useSearchParams();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ticketsView") as
        | "list"
        | "kanban"
        | null;
      if (stored) setView(stored);
    } catch {}
    const handler = (e: Event) => {
      try {
        const v = (e as CustomEvent).detail as "list" | "kanban" | undefined;
        if (v === "list" || v === "kanban") setView(v);
        else {
          const stored = localStorage.getItem("ticketsView") as
            | "list"
            | "kanban"
            | null;
          if (stored) setView(stored);
        }
      } catch {}
    };
    window.addEventListener("tickets:view-changed", handler as any);
    return () =>
      window.removeEventListener("tickets:view-changed", handler as any);
  }, []);

  const total = pagination?.total ?? items.length;

  const Empty = (
    <div className="border border-dashed border-border rounded p-10 text-center text-sm bg-card">
      <div className="mx-auto w-10 h-10 mb-2 text-muted-foreground">
        <Inbox className="w-10 h-10" />
      </div>
      <div className="font-medium mb-1">
        Aucun ticket ne correspond à vos filtres
      </div>
      <div className="text-muted-foreground mb-4">
        Essayez de réinitialiser les filtres ou créez un nouveau ticket.
      </div>
      <div className="flex items-center justify-center gap-2">
        <Link
          href="/tickets"
          className="inline-flex items-center justify-center h-9 px-3 rounded border border-border"
        >
          Réinitialiser
        </Link>
        <Link
          href="/tickets/create"
          className="inline-flex items-center justify-center h-9 px-3 rounded bg-primary text-primary-foreground"
        >
          Nouveau ticket
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {total} ticket{total > 1 ? "s" : ""}
        </div>
        <Link
          href="/tickets/create"
          className="inline-flex items-center justify-center h-9 px-3 rounded bg-primary text-primary-foreground"
        >
          Nouveau ticket
        </Link>
      </div>

      {view === "kanban" ? (
        items.length === 0 ? (
          Empty
        ) : (
          <KanbanClient items={items} currentUserId={currentUserId} />
        )
      ) : items.length === 0 ? (
        Empty
      ) : (
        <div className="overflow-x-auto bg-card border border-border rounded">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Priorité</th>
                <th className="px-3 py-2">Assigné à</th>
                <th className="px-3 py-2">Créé</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border hover:bg-muted/40"
                >
                  <td className="px-3 py-2">
                    <Link
                      className="text-accent underline-offset-4 hover:underline"
                      href={`/tickets/${t.id}`}
                    >
                      {(t.ticketNumber ? `${t.ticketNumber} — ` : "") + t.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <BadgeStatus value={t.status} />
                  </td>
                  <td className="px-3 py-2">
                    <BadgePriority value={t.priority} />
                  </td>
                  <td className="px-3 py-2">
                    {t.assignedTo?.name || t.assignedTo?.email || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "list" && pagination && (
        <div className="flex items-center justify-between text-sm">
          <PageLink
            sp={sp}
            page={Math.max(1, (pagination.page || 1) - 1)}
            disabled={pagination.page <= 1}
          >
            Précédent
          </PageLink>
          <div className="text-muted-foreground">
            Page {pagination.page} / {pagination.pages}
          </div>
          <PageLink
            sp={sp}
            page={Math.min(pagination.pages, (pagination.page || 1) + 1)}
            disabled={pagination.page >= pagination.pages}
          >
            Suivant
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({
  sp,
  page,
  disabled,
  children,
}: {
  sp: ReturnType<typeof useSearchParams>;
  page: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams(sp?.toString());
  params.set("page", String(page));
  return (
    <Link
      href={{
        pathname: "/tickets",
        query: Object.fromEntries(params.entries()),
      }}
      className={`px-3 h-9 rounded border border-border inline-flex items-center ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {children}
    </Link>
  );
}
