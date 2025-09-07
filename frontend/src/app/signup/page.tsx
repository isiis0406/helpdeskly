"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupTenantAction } from "@/app/actions/tenants";
import { signIn } from "next-auth/react";
import { signupSchema, type SignupInput } from "@/lib/schemas/tenants";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { slugify } from "@/lib/slugify";
import { setTenantSlugAction } from "@/app/actions/tenant-context";

type FormValues = SignupInput;

export default function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | undefined>(
    undefined
  );
  const [isPending, startTransition] = useTransition();
  const baseDomain = process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN || 'helpdeskly.com'

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
  const methods = useMemo(() => ({ register, handleSubmit, setValue, watch, formState: { errors } }), [register, handleSubmit, setValue, watch, errors]);

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    setSuggestions(undefined)
    startTransition(async () => {
      try {
        const res = await signupTenantAction(values)
        if (!res.ok) {
          setServerError(res.message || 'Inscription impossible')
          setSuggestions(res.suggestions)
          return
        }
        // Définir le tenant courant pour l'App API
        try {
          const createdSlug = (res as any)?.data?.tenant?.slug || (methods as any).watch?.('slug')
          if (createdSlug) await setTenantSlugAction(createdSlug)
        } catch {}
        // Connexion automatique (sans redirection implicite pour contrôler l'UX)
        const sign = await signIn('credentials', {
          email: values.adminEmail,
          password: values.adminPassword,
          tenantSlug: (methods as any).watch?.('slug') || undefined,
          redirect: false,
        })
        if (sign?.ok) {
          window.location.href = '/dashboard'
        } else {
          setServerError("Compte créé mais la connexion automatique a échoué. Veuillez vous connecter.")
        }
      } catch (e: any) {
        setServerError(e?.message || 'Une erreur est survenue')
      }
    })
  }

  // Auto-suggestion du slug à partir du nom (non exposé en champ éditable)
  const tenantName = watch("tenantName");

  useEffect(() => {
    const tn = watch("tenantName");
    setValue("slug", slugify(tn || ""), { shouldValidate: true });
  }, [watch("tenantName")]);

  return (
    <main className="container mx-auto px-6 py-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-6">
        Démarrer votre essai gratuit
      </h1>
      <p className="text-muted-foreground mb-8">
        Créez votre espace Helpdeskly et invitez votre équipe en quelques
        minutes.
      </p>

      <FormProvider {...(methods as any)}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card border border-border rounded-lg p-6"
        >
          <div className="md:col-span-2 grid gap-1">
            <FormLabel>Nom de l'organisation</FormLabel>
            <Input {...register("tenantName")} />
            <FormMessage>{errors.tenantName?.message as any}</FormMessage>
          </div>

          <input type="hidden" {...register("slug")} />
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Adresse de l'espace: https://<span className="font-mono">{watch("slug") || "votre-entreprise"}</span>.{baseDomain}
          </div>

          <div className="grid gap-1">
            <FormLabel>Email administrateur</FormLabel>
            <Input type="email" {...register("adminEmail")} />
            <FormMessage>{errors.adminEmail?.message as any}</FormMessage>
          </div>

          <div className="grid gap-1">
            <FormLabel>Nom administrateur</FormLabel>
            <Input {...register("adminName")} />
            <FormMessage>{errors.adminName?.message as any}</FormMessage>
          </div>

          <div className="grid gap-1">
            <FormLabel>Mot de passe</FormLabel>
            <Input type="password" {...register("adminPassword")} />
            <FormMessage>{errors.adminPassword?.message as any}</FormMessage>
          </div>

          <div className="md:col-span-2 grid gap-1">
            <FormLabel>Description (facultatif)</FormLabel>
            <textarea className="w-full border border-border rounded px-3 py-2 bg-card" rows={3} {...register("description")} />
            <FormMessage>{errors.description?.message as any}</FormMessage>
          </div>

        {/* v2: logo uploader & domaine provisionné automatiquement côté backend */}

        {/* Jours d'essai définis par configuration (env côté front et backend) */}

          <div className="md:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="terms" {...register("acceptTerms")} />
            <label htmlFor="terms" className="text-sm">
              J'accepte les{' '}
              <Link href="#" className="text-primary underline">CGU</Link>
            </label>
            <FormMessage>{errors.acceptTerms?.message as any}</FormMessage>
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
                    onClick={() => { setValue("slug", s, { shouldValidate: true }) }}
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
            <Button disabled={isPending}>{isPending ? 'Création…' : "Commencer l'essai"}</Button>
            <Link href="/auth/sign-in" className="px-5 py-3 rounded border border-border text-foreground hover:bg-muted">
              J'ai déjà un compte
            </Link>
          </div>
        </form>
      </FormProvider>
    </main>
  );
}
