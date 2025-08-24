#!/bin/bash
# filepath: /Users/issabalde/Developer/ISIIS/formation/multitenant/helpdeskly/scripts/migrate.sh

echo "🚀 Starting migration to new architecture..."

# Retour à la racine du projet
cd "$(dirname "$0")/.."

# 1. Backup des données existantes (optionnel si pg_dump disponible)
if command -v pg_dump &> /dev/null; then
    echo "📦 Creating backup..."
    pg_dump $CONTROL_DATABASE_URL > backup_control_$(date +%Y%m%d_%H%M%S).sql
else
    echo "⚠️  pg_dump not found, skipping backup. Install PostgreSQL client tools if needed."
fi

# 2. Reset des migrations existantes pour éviter les conflits
echo "🔄 Resetting existing migrations..."
pnpm exec prisma migrate reset --force --schema=prisma/control/schema.prisma

# 3. Création des nouvelles migrations
echo "🔄 Creating new control schema migration..."
pnpm exec prisma migrate dev --name "centralize-users-hybrid-secrets" --schema=prisma/control/schema.prisma

echo "🔄 Migrating tenant schema..."
pnpm exec prisma migrate dev --name "remove-users-table" --schema=prisma/tenant/schema.prisma

# 4. Regénération des clients
echo "🔨 Generating Prisma clients..."
pnpm exec prisma generate --schema=prisma/control/schema.prisma
pnpm exec prisma generate --schema=prisma/tenant/schema.prisma

# 5. Installation des nouvelles dépendances dans app-api
echo "📦 Installing new dependencies..."
cd apps/app-api
pnpm add nestjs-cls lru-cache
pnpm add -D @types/lru-cache

# Retour à la racine
cd ../..

echo "✅ Migration completed!"
echo "📋 Next steps:"
echo "   1. Create seed data for users and memberships"
echo "   2. Test tenant resolution with new middleware"
echo "   3. Update API endpoints to use new architecture"
echo "   4. Configure monitoring and metrics"