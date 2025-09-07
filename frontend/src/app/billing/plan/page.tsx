import { cookies } from "next/headers";
import { TenantPicker } from "@/components/tenant-picker";
import {
  getCurrentSubscription,
  changePlanAction,
} from "@/app/actions/billing";
import { getPlans } from "@/app/actions/plans";

export default async function MyPlanPage() {
  const tenantSlug = (await cookies()).get("tenantSlug")?.value;
  const [subscription, plans] = await Promise.all([
    getCurrentSubscription(),
    getPlans(),
  ]);

  return (
    <main className="container mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Mon plan</h1>

      <div className="mb-6">
        <TenantPicker initial={tenantSlug} />
        {!tenantSlug && (
          <p className="text-sm text-muted-foreground mt-2">
            Sélectionnez un tenant pour voir/mettre à jour l'abonnement.
          </p>
        )}
      </div>

      {tenantSlug && (
        <div className="grid md:grid-cols-2 gap-6">
          <section className="border border-border rounded p-4 bg-card">
            <h2 className="font-medium mb-2">Abonnement actuel</h2>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto">
              {JSON.stringify(subscription, null, 2)}
            </pre>
          </section>
          <section className="border border-border rounded p-4 bg-card">
            <h2 className="font-medium mb-4">Changer de plan</h2>
            <form action={upgradeAction} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Nouveau plan</label>
                <select
                  name="planId"
                  className="w-full border border-border rounded px-3 py-2 bg-card"
                >
                  {Array.isArray(plans) &&
                    plans.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName || p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Cycle</label>
                <select
                  name="billingCycle"
                  className="w-full border border-border rounded px-3 py-2 bg-card"
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="YEARLY">Annuel</option>
                </select>
              </div>
              <button className="px-4 py-2 rounded bg-primary text-primary-foreground">
                Mettre à niveau
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

async function upgradeAction(formData: FormData) {
  "use server";
  const planId = String(formData.get("planId") || "");
  const billingCycle = String(formData.get("billingCycle") || "MONTHLY") as
    | "MONTHLY"
    | "YEARLY";
  if (!planId) return;
  await changePlanAction(planId, billingCycle);
}
