export function tStatus(value: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'): string {
  switch (value) {
    case 'OPEN': return 'Ouvert'
    case 'IN_PROGRESS': return 'En cours'
    case 'RESOLVED': return 'Résolu'
    case 'CLOSED': return 'Fermé'
    default: return String(value)
  }
}

export function tPriority(value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'): string {
  switch (value) {
    case 'LOW': return 'Basse'
    case 'MEDIUM': return 'Moyenne'
    case 'HIGH': return 'Haute'
    case 'URGENT': return 'Urgente'
    default: return String(value)
  }
}

