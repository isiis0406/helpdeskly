// NOTE: Avoid importing generated Prisma enums in seeds to prevent TS issues
// when the client isn't generated yet in editors. Use string literals instead.

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const SAMPLE_TITLES: string[] = [
  'Impossible de se connecter',
  'Erreur 500 sur la page Tickets',
  'Notification email non reçue',
  'Export CSV échoue',
  'Performance lente sur le dashboard',
  'Problème de permissions utilisateur',
  'Intégration Slack ne fonctionne pas',
  'SSO renvoie une erreur',
  'Taille de fichier trop grande',
  'API rate limit atteint',
]

const SAMPLE_DESCRIPTIONS: string[] = [
  "Lorsque j'essaie de me connecter, le système me renvoie sur la page d'accueil sans message.",
  'Nous constatons des erreurs 500 intermittentes depuis 10h.',
  "Plusieurs utilisateurs n'ont pas reçu de mail de notification hier soir.",
  "L'export CSV retourne un fichier vide.",
  'Le chargement du dashboard prend parfois plus de 10 secondes.',
]

const SAMPLE_COMMENT_BODIES: string[] = [
  'Nous investiguons le problème.',
  'Pouvez-vous fournir une capture d’écran ?',
  'Le correctif est en cours de déploiement.',
  'Avez-vous réessayé après avoir vidé le cache ?',
  'Corrigé dans la version 1.2.3.',
]

export async function seedTicketsAndComments(prisma: any) {
  const existing = await prisma.ticket.count()
  const force = process.env.SEED_TENANT_FORCE === '1'

  if (existing > 0 && !force) {
    console.log(`➡️  Tenant DB contient déjà ${existing} tickets. Skip (SEED_TENANT_FORCE=1 pour forcer).`)
    return
  }

  if (force) {
    console.log('♻️  SEED_TENANT_FORCE=1 — nettoyage des tickets, comments et usage_events...')
    try {
      await prisma.$transaction([
        prisma.usageEvent.deleteMany({}),
        prisma.comment.deleteMany({}),
        prisma.ticket.deleteMany({}),
      ])
    } catch (e) {
      console.log('  ⚠️  Reset skipped or partial (tables might not exist yet). Continuing...')
    }
  }

  const toCreate = 15
  console.log(`➡️  Création de ${toCreate} tickets avec commentaires & events...`)

  for (let i = 0; i < toCreate; i++) {
    const title = SAMPLE_TITLES[i % SAMPLE_TITLES.length]
    const description = SAMPLE_DESCRIPTIONS[i % SAMPLE_DESCRIPTIONS.length]

    const status = pick<string>(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
    const priority = pick<string>(['LOW', 'MEDIUM', 'HIGH'])

    // IDs utilisateurs de la DB control (fictifs ici)
    const authorId = 'user_demo_author'
    const assignedToId = Math.random() < 0.6 ? 'user_demo_agent' : null

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        status,
        priority,
        authorId,
        assignedToId,
      },
    })

    // Log usage event for ticket creation
    await prisma.usageEvent.create({
      data: {
        eventType: 'CREATE',
        entityType: 'TICKET',
        entityId: ticket.id,
        incrementValue: 1,
        userId: authorId,
        ticketId: ticket.id,
      },
    })

    // Comments (0–3)
    const commentsToCreate = Math.floor(Math.random() * 4)
    for (let j = 0; j < commentsToCreate; j++) {
      const body = pick(SAMPLE_COMMENT_BODIES)
      const comment = await prisma.comment.create({
        data: {
          body,
          ticketId: ticket.id,
          authorId: j % 2 === 0 ? 'user_demo_agent' : authorId,
        },
      })

      await prisma.usageEvent.create({
        data: {
          eventType: 'CREATE',
          entityType: 'COMMENT',
          entityId: comment.id,
          incrementValue: 1,
          userId: comment.authorId,
          commentId: comment.id,
          ticketId: ticket.id,
        },
      })
    }
  }

  const [tCount, cCount, uCount] = await Promise.all([
    prisma.ticket.count(),
    prisma.comment.count(),
    prisma.usageEvent.count(),
  ])
  console.log(`✅ Tenant seed terminé. Tickets=${tCount}, Comments=${cCount}, UsageEvents=${uCount}`)
}
