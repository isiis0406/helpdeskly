"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
      className="h-9 px-3  text-sm"
    >
      <LogOut />
    </button>
  );
}
