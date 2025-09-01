"use client";
import { setTenantSlugAction } from "@/app/actions/tenant-context";
import { useState, useTransition } from "react";

export function TenantPicker({ initial }: { initial?: string }) {
  const [slug, setSlug] = useState(initial || "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setTenantSlugAction(slug.trim());
      window.location.reload();
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="block text-sm mb-1">Tenant slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="border rounded px-3 py-2"
          placeholder="ma-startup"
        />
      </div>
      <button
        onClick={save}
        disabled={isPending || !slug}
        className="h-10 px-4 rounded bg-blue-600 text-white disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : "Utiliser"}
      </button>
    </div>
  );
}
