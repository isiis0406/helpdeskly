import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function hasRouteAccess(pathname: string, role?: string): boolean {
  // Normalize role string
  const r = (role || "").toUpperCase();
  // Admin areas
  if (pathname.startsWith("/billing")) return r === "OWNER" || r === "ADMIN";
  if (pathname.startsWith("/settings/users"))
    return r === "OWNER" || r === "ADMIN";
  if (pathname.startsWith("/settings")) return r === "OWNER" || r === "ADMIN";
  // Tickets area accessible to all authenticated roles
  if (pathname.startsWith("/tickets")) return true;
  if (pathname.startsWith("/dashboard")) return true;
  return true;
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Never guard NextAuth or auth pages
  if (path.startsWith("/api/auth") || path.startsWith("/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    const relative = req.nextUrl.pathname + req.nextUrl.search;
    url.searchParams.set("callbackUrl", relative);
    return NextResponse.redirect(url);
  }

  const role =
    (token as any)?.user?.currentTenant?.role ||
    (token as any)?.user?.memberships?.[0]?.role;
  if (!hasRouteAccess(path, role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.searchParams.delete("callbackUrl");
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/tickets/:path*",
    "/billing/:path*",
    "/settings/:path*",
  ],
};
