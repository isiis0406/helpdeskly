# ════════════════════════════════════════════════════
# 🏗️ DOCKERFILE CORRIGÉ POUR STRUCTURE RÉELLE
# ════════════════════════════════════════════════════

FROM node:20-alpine AS builder

WORKDIR /app

# Installation de pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copier les fichiers de configuration
COPY package.json pnpm-lock.yaml ./
COPY apps/control-api/package.json ./apps/control-api/
COPY apps/app-api/package.json ./apps/app-api/

# Copier les configurations
COPY tsconfig.json nest-cli.json ./
COPY prisma ./prisma

# Installer toutes les dépendances
RUN pnpm install --frozen-lockfile

# Copier le code source
COPY . .

# Générer les clients Prisma
RUN pnpm exec prisma generate --schema=./prisma/control/schema.prisma
RUN pnpm exec prisma generate --schema=./prisma/tenant/schema.prisma

# Build les applications (chacune dans son dossier)
RUN echo "🏗️ Building control-api..." && \
    pnpm --filter control-api build && \
    echo "✅ Control API build terminé"

RUN echo "🏗️ Building app-api..." && \
    pnpm --filter app-api build && \
    echo "✅ App API build terminé"

# ✅ Debug : vérifier la structure après build
RUN echo "📁 Structure après build:" && \
    ls -la apps/control-api/ && \
    echo "📁 Contenu control-api/dist:" && \
    ls -la apps/control-api/dist/ && \
    echo "📁 Contenu app-api/dist:" && \
    ls -la apps/app-api/dist/

# ════════════════════════════════════════════════════
# 🎛️ STAGE PRODUCTION: CONTROL API
# ════════════════════════════════════════════════════

FROM node:20-alpine AS control-api

WORKDIR /app

# Installation de curl pour health checks
RUN apk add --no-cache curl

# Installation de pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# ✅ Copier depuis la vraie structure
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/control-api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=6500

# Changer vers l'utilisateur non-root
USER nestjs

# Port d'exposition
EXPOSE 6500

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:6500/health || exit 1

# ✅ Commande corrigée pour la vraie structure
CMD ["node", "dist/main.js"]

# ════════════════════════════════════════════════════
# 🎫 STAGE PRODUCTION: APP API
# ════════════════════════════════════════════════════

FROM node:20-alpine AS app-api

WORKDIR /app

# Installation de curl pour health checks
RUN apk add --no-cache curl

# Installation de pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# ✅ Copier depuis la vraie structure
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/app-api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=6501

# Changer vers l'utilisateur non-root
USER nestjs

# Port d'exposition
EXPOSE 6501

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:6501/health || exit 1

# ✅ Commande corrigée pour la vraie structure
CMD ["node", "dist/main.js"]