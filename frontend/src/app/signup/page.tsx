"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupTenantAction } from "@/app/actions/tenants";
import { signIn } from "next-auth/react";
import { signupSchema, type SignupInput } from "@/lib/schemas/tenants";
import Link from "next/link";

type FormValues = SignupInput;

export default function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | undefined>(
    undefined
  );
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(signupSchema) as any,
    defaultValues: { acceptTerms: true },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    setSuggestions(undefined);
    startTransition(async () => {
      const res = await signupTenantAction(values);
      if (!res.ok) {
        setServerError(res.message || "Inscription impossible");
        setSuggestions(res.suggestions);
        return;
      }
      // Auto-login avec les credentials saisis
      await signIn("credentials", {
        email: values.adminEmail,
        password: values.adminPassword,
        redirect: true,
        callbackUrl: "/dashboard",
      });
    });
  };

  // Auto-suggestion du slug à partir du nom
  const tenantName = watch("tenantName");
  function suggestSlugFromName(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return (
    <main className="container mx-auto px-6 py-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">
        Démarrer votre essai gratuit
      </h1>
      <p className="text-gray-600 mb-8">
        Créez votre espace Helpdeskly et invitez votre équipe en quelques
        minutes.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border rounded-lg p-6"
      >
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Nom de l'organisation</label>
          <input
            className="w-full border rounded px-3 py-2"
            {...register("tenantName")}
            onBlur={() => {
              const current = watch("slug");
              if (!current)
                setValue("slug", suggestSlugFromName(tenantName || ""), {
                  shouldValidate: true,
                });
            }}
          />
          {errors.tenantName && (
            <p className="text-sm text-red-600">
              {errors.tenantName.message as string}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">Slug</label>
          <input
            className="w-full border rounded px-3 py-2 font-mono"
            placeholder="ma-startup"
            {...register("slug")}
          />
          <p className="text-xs text-gray-500 mt-1">
            URL: https://<span className="font-mono">votre-slug</span>
            .helpdeskly.com
          </p>
          {errors.slug && (
            <p className="text-sm text-red-600">
              {errors.slug.message as string}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Email administrateur</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            {...register("adminEmail")}
          />
          {errors.adminEmail && (
            <p className="text-sm text-red-600">
              {errors.adminEmail.message as string}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">Nom administrateur</label>
          <input
            className="w-full border rounded px-3 py-2"
            {...register("adminName")}
          />
          {errors.adminName && (
            <p className="text-sm text-red-600">
              {errors.adminName.message as string}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Mot de passe</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            {...register("adminPassword")}
          />
          {errors.adminPassword && (
            <p className="text-sm text-red-600">
              {errors.adminPassword.message as string}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Description (facultatif)</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-red-600">
              {errors.description.message as string}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">Logo (URL)</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="https://…"
            {...register("logo")}
          />
          {errors.logo && (
            <p className="text-sm text-red-600">
              {errors.logo.message as string}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Domaine personnalisé</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="support.votre-domaine.com"
            {...register("customDomain")}
          />
          {errors.customDomain && (
            <p className="text-sm text-red-600">
              {errors.customDomain.message as string}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">Jours d'essai (1-365)</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            min={1}
            max={365}
            {...register("trialDays", { valueAsNumber: true })}
          />
          {errors.trialDays && (
            <p className="text-sm text-red-600">
              {errors.trialDays.message as string}
            </p>
          )}
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="terms" {...register("acceptTerms")} />
          <label htmlFor="terms" className="text-sm">
            J'accepte les{" "}
            <Link href="#" className="text-blue-600 underline">
              CGU
            </Link>
          </label>
          {errors.acceptTerms && (
            <p className="text-sm text-red-600">
              {errors.acceptTerms.message as string}
            </p>
          )}
        </div>

        {serverError && (
          <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
            {serverError}
            {suggestions && suggestions.length > 0 && (
              <div className="mt-2">
                Suggestions:{" "}
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setValue("slug", s)}
                    className="ml-2 underline"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="md:col-span-2 flex gap-3">
          <button
            disabled={isPending}
            className="px-5 py-3 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Création…" : "Commencer l'essai"}
          </button>
          <Link
            href="/auth/sign-in"
            className="px-5 py-3 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            J'ai déjà un compte
          </Link>
        </div>
      </form>
    </main>
  );
}
