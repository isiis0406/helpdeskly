"use server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { buildControlApiUrl } from "@/lib/env";
import { cookies } from "next/headers";
import { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiFetchServer<T = unknown>(
  path: string,
  options: {
    method?: Method;
    body?: unknown;
    tenantSlug?: string;
    token?: string; // optional override
  } = {},
  schema?: z.ZodSchema<T>
): Promise<T> {
  const session = await auth();
  const token = options.token || (session as any)?.accessToken;

  // derive tenant from cookie if not given
  if (!options.tenantSlug) {
    try {
      options.tenantSlug = (await cookies()).get("tenantSlug")?.value as any;
    } catch {}
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.tenantSlug) headers["x-tenant-slug"] = options.tenantSlug;

  const res = await fetch(buildControlApiUrl(path), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    throw new Error(
      json?.message || `API error ${res.status} on ${path}: ${res.statusText}`
    );
  }

  if (schema) return schema.parse(json);
  return json as T;
}
