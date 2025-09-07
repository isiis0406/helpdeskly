import { tPriority, tStatus } from "@/lib/i18n"

export function BadgeStatus({ value }: { value: 'OPEN'|'IN_PROGRESS'|'RESOLVED'|'CLOSED' }) {
  const label = tStatus(value)
  const cls =
    value === 'OPEN' ? 'bg-caribbean text-white' :
    value === 'IN_PROGRESS' ? 'bg-platinum text-jet' :
    value === 'RESOLVED' ? 'bg-green-600 text-white' :
    'bg-jet text-white'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}

export function BadgePriority({ value }: { value: 'LOW'|'MEDIUM'|'HIGH'|'URGENT' }) {
  const label = tPriority(value)
  const cls =
    value === 'LOW' ? 'bg-platinum text-jet' :
    value === 'MEDIUM' ? 'bg-caribbean text-white' :
    value === 'HIGH' ? 'bg-yellow-600 text-white' :
    'bg-red-600 text-white'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}

