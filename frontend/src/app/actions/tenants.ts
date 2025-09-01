"use server";
import { buildControlApiUrl } from "@/lib/env";
import { signupSchema, type SignupInput } from "@/lib/schemas/tenants";

export async function signupTenantAction(input: SignupInput) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, errors: parsed.error.flatten() };
  }

  // Path WITHOUT version; version handled globally via env
  const DEFAULT_TRIAL = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS || 15);
  const res = await fetch(buildControlApiUrl("/tenants/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: input.slug,
      tenantName: input.tenantName,
      description: input.description || undefined,
      logo: input.logo || undefined,
      trialDays: DEFAULT_TRIAL,
      adminName: input.adminName,
      adminEmail: input.adminEmail,
      adminPassword: input.adminPassword,
      acceptTerms: input.acceptTerms,
    }),
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: data?.message || "Inscription impossible",
      suggestions: data?.suggestions,
      errors: data?.errors,
    };
  }

  return { ok: true, data };
}
