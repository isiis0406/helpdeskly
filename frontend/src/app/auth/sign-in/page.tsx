"use client";
import { signInSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (values: z.infer<typeof signInSchema>) => {
    setError(null);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      tenantSlug: values.tenantSlug || undefined,
      redirect: false,
    });
    if (res?.ok) {
      window.location.href = "/dashboard";
    } else {
      setError("Identifiants invalides");
    }
  };

  return (
    <main className="flex-1 container mx-auto p-6 max-w-md">
      <h1 className="text-2xl font-semibold mb-4">Connexion</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-card border border-border rounded p-4">
        <div>
          <label className="block text-sm mb-1">Slug (tenant)</label>
          <input className="w-full border border-border rounded px-3 py-2 bg-card" placeholder="ma-startup" {...register('tenantSlug')} />
          <p className="text-xs text-muted-foreground mt-1">Optionnel. Utile si vous avez plusieurs workspaces.</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            className="w-full border border-border rounded px-3 py-2 bg-card"
            type="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Mot de passe</label>
          <input
            className="w-full border border-border rounded px-3 py-2 bg-card"
            type="password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={isSubmitting} className="bg-primary text-primary-foreground px-4 py-2 rounded">
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
