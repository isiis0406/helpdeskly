"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { clearTenantSlugAction } from "@/app/actions/tenant-context";

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        try { await clearTenantSlugAction() } catch {}
        await signOut({ callbackUrl: "/auth/sign-in" })
      }}
      className="h-9 px-3  text-sm"
    >
      <LogOut />
    </button>
  );
}
