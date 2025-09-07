import { tPriority, tStatus } from "@/lib/i18n";

export function BadgeStatus({
  value,
}: {
  value: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
}) {
  const label = tStatus(value);

  const styles = {
    OPEN: "bg-cyan-600 text-white", // ✅ CYAN pour OUVERT
    IN_PROGRESS: "bg-amber-500 text-white", // ✅ AMBRE pour EN COURS
    RESOLVED: "bg-green-600 text-white", // ✅ VERT pour RÉSOLU
    CLOSED: "bg-slate-700 text-white", // ✅ ARDOISE pour FERMÉ
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[value]}`}
    >
      {label}
    </span>
  );
}

export function BadgePriority({
  value,
}: {
  value: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  const label = tPriority(value);

  const styles = {
    LOW: "bg-slate-300 text-slate-700", // ✅ GRIS pour FAIBLE
    MEDIUM: "bg-blue-500 text-white", // ✅ BLEU pour MOYENNE
    HIGH: "bg-orange-500 text-white", // ✅ ORANGE pour HAUTE
    URGENT: "bg-red-600 text-white", // ✅ ROUGE pour URGENT
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[value]}`}
    >
      {label}
    </span>
  );
}
