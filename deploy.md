# 🚀 Guide de Déploiement Helpdeskly

## 📋 Architecture Complète

L'application Helpdeskly est composée de :

- **Control API** (6500) : Gestion des tenants et authentification
- **App API** (6501) : Gestion des tickets multi-tenant
- **PostgreSQL** : Base de données principale + bases tenants
- **Redis** : Cache et sessions
- **PgBouncer** : Pool de connexions
- **PgAdmin** : Interface d'administration

---

## 🔧 Configuration Environnement

### 📄 Fichier `.env.production`

```bash
# ================== Environment ==================
NODE_ENV=production

# PORT
CONTROL_PORT=6500
APP_PORT=6501
FRONTEND_URL=https://app.votre-domaine.com

# ================== Control API ==================
CONTROL_DATABASE_URL=postgresql://helpdeskly_user:${CONTROL_DB_PASSWORD}@postgres:5432/helpdeskly_control

# ================== Tenant Database Template ==================
DATABASE_URL=postgresql://helpdeskly_user:${TENANT_DB_PASSWORD}@postgres:5432/postgres

# JWT Configuration (⚠️ CHANGEZ EN PRODUCTION!)
JWT_SECRET=votre-clé-super-secrète-production-minimum-32-caractères-2024
JWT_EXPIRES_IN=15m
JWT_EXPIRES_IN_SECONDS=900
JWT_ISSUER=helpdeskly-prod
JWT_AUDIENCE=helpdeskly-users-prod

# Refresh Token Configuration
REFRESH_TOKEN_DAYS=7

# Security
BCRYPT_ROUNDS=12

# ================== Redis ==================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

# ================== Security ==================
DB_ENCRYPTION_KEY="votre-clé-secrète-db-encryption-32chars-prod"

# ================== Monitoring ==================
LOG_LEVEL=info
ENABLE_METRICS=true
ENABLE_SWAGGER=false

# ================== Database Credentials ==================
POSTGRES_USER=helpdeskly_user
POSTGRES_PASSWORD=super_secure_password_2024
CONTROL_DB_PASSWORD=control_db_secure_password_2024
TENANT_DB_PASSWORD=tenant_db_secure_password_2024

# ================== CORS ==================
CORS_ORIGINS=https://app.votre-domaine.com,https://admin.votre-domaine.com
```

---

## 🐳 Docker Compose Production

### 📄 `docker-compose.prod.yml`

```yaml
version: "3.9"

services:
  # ════════════════════════════════════════════════════
  # 🗄️ INFRASTRUCTURE DATABASE
  # ════════════════════════════════════════════════════

  postgres:
    image: postgres:16-alpine
    container_name: helpdeskly-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db-prod.sql:/docker-entrypoint-initdb.d/init-db.sql
    networks:
      - helpdeskly-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Base pour migrations initiales (optionnelle en prod)
  postgres_migrations:
    image: postgres:16-alpine
    container_name: helpdeskly-postgres-migrations
    restart: "no"
    ports:
      - "5436:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    networks:
      - helpdeskly-network

  # ────────────────────────────────────────────────────
  # 🔗 PGBOUNCER - Connection Pooling
  # ────────────────────────────────────────────────────

  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: helpdeskly-pgbouncer
    restart: unless-stopped
    ports:
      - "6432:6432"
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postgres
      AUTH_USER: ${POSTGRES_USER}
      AUTH_PASSWORD: ${POSTGRES_PASSWORD}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 25
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - helpdeskly-network

  # ────────────────────────────────────────────────────
  # 🔴 REDIS - Cache & Sessions
  # ────────────────────────────────────────────────────

  redis:
    image: redis:7-alpine
    container_name: helpdeskly-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - helpdeskly-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  # ════════════════════════════════════════════════════
  # 🎛️ APIS HELPDESKLY
  # ════════════════════════════════════════════════════

  # Control API - Gestion des tenants
  control-api:
    build:
      context: .
      dockerfile: Dockerfile
      target: control-api
    container_name: helpdeskly-control-api
    restart: unless-stopped
    ports:
      - "6500:6500"
    environment:
      NODE_ENV: production
      PORT: 6500
      CONTROL_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/helpdeskly_control
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      JWT_ISSUER: ${JWT_ISSUER}
      JWT_AUDIENCE: ${JWT_AUDIENCE}
      REDIS_URL: redis://redis:6379
      BCRYPT_ROUNDS: ${BCRYPT_ROUNDS}
      LOG_LEVEL: ${LOG_LEVEL}
      ENABLE_SWAGGER: ${ENABLE_SWAGGER}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - helpdeskly-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6500/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # App API - Gestion des tickets
  app-api:
    build:
      context: .
      dockerfile: Dockerfile
      target: app-api
    container_name: helpdeskly-app-api
    restart: unless-stopped
    ports:
      - "6501:6501"
    environment:
      NODE_ENV: production
      PORT: 6501
      CONTROL_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/helpdeskly_control
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postgres
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      JWT_ISSUER: ${JWT_ISSUER}
      JWT_AUDIENCE: ${JWT_AUDIENCE}
      REDIS_URL: redis://redis:6379
      DB_ENCRYPTION_KEY: ${DB_ENCRYPTION_KEY}
      LOG_LEVEL: ${LOG_LEVEL}
      ENABLE_SWAGGER: ${ENABLE_SWAGGER}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      control-api:
        condition: service_healthy
    networks:
      - helpdeskly-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6501/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ════════════════════════════════════════════════════
  # 🛠️ OUTILS D'ADMINISTRATION
  # ════════════════════════════════════════════════════

  # PgAdmin - Interface d'administration BDD
  pgadmin:
    image: dpage/pgadmin4:8
    container_name: helpdeskly-pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@helpdeskly.local
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD:-admin_secure_password_2024}
      PGADMIN_LISTEN_PORT: 80
      PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION: "True"
      PGADMIN_CONFIG_CONSOLE_LOG_LEVEL: 30
    volumes:
      - pgadmin_data:/var/lib/pgadmin
      - ./pgadmin/servers.json:/pgadmin4/servers.json:ro
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - helpdeskly-network
    profiles:
      - tools # Utilise 'docker-compose --profile tools up' pour inclure

  # ────────────────────────────────────────────────────
  # 🌐 REVERSE PROXY NGINX
  # ────────────────────────────────────────────────────

  nginx:
    image: nginx:alpine
    container_name: helpdeskly-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      control-api:
        condition: service_healthy
      app-api:
        condition: service_healthy
    networks:
      - helpdeskly-network
    profiles:
      - proxy

# ════════════════════════════════════════════════════
# 💾 VOLUMES PERSISTANTS
# ════════════════════════════════════════════════════

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  pgadmin_data:
    driver: local

# ════════════════════════════════════════════════════
# 🌐 RÉSEAUX
# ════════════════════════════════════════════════════

networks:
  helpdeskly-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## 🐳 Dockerfile Multi-Stage

### 📄 `Dockerfile`

```dockerfile
# ════════════════════════════════════════════════════
# 🏗️ DOCKERFILE MULTI-STAGE PRODUCTION
# ════════════════════════════════════════════════════

# Stage 1: Builder
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

# Build les deux applications
RUN pnpm --filter control-api build
RUN pnpm --filter app-api build

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

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
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

# Commande de démarrage
CMD ["node", "dist/apps/control-api/main"]

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

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
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

# Commande de démarrage
CMD ["node", "dist/apps/app-api/main"]
```

---

## 🌐 Configuration Nginx

### 📄 `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    # Upstreams
    upstream control-api {
        server control-api:6500;
    }

    upstream app-api {
        server app-api:6501;
    }

    # ════════════════════════════════════════════════════
    # 🎛️ CONTROL API
    # ════════════════════════════════════════════════════
    server {
        listen 80;
        server_name control-api.votre-domaine.com;

        # Rate limiting plus strict pour l'auth
        limit_req zone=auth burst=10 nodelay;

        # Headers de sécurité
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        location / {
            proxy_pass http://control-api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://control-api/health;
            access_log off;
        }
    }

    # ════════════════════════════════════════════════════
    # 🎫 APP API
    # ════════════════════════════════════════════════════
    server {
        listen 80;
        server_name app-api.votre-domaine.com;

        # Rate limiting
        limit_req zone=api burst=20 nodelay;

        # Headers de sécurité
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        location / {
            proxy_pass http://app-api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://app-api/health;
            access_log off;
        }
    }

    # ════════════════════════════════════════════════════
    # 🛠️ PGADMIN (Optionnel)
    # ════════════════════════════════════════════════════
    server {
        listen 80;
        server_name pgadmin.votre-domaine.com;

        # Restriction d'accès (remplacez par vos IPs)
        # allow 192.168.1.0/24;
        # deny all;

        location / {
            proxy_pass http://pgadmin:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

## 📄 Scripts de Déploiement

### 📄 `scripts/deploy.sh`

```bash
#!/bin/bash
# ════════════════════════════════════════════════════
# 🚀 SCRIPT DE DÉPLOIEMENT PRODUCTION HELPDESKLY
# ════════════════════════════════════════════════════

set -e

# Variables
ENVIRONMENT=${1:-production}
VERSION=$(git rev-parse --short HEAD)
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Déploiement Helpdeskly ${ENVIRONMENT}"
echo "📋 Version: ${VERSION}"
echo "📋 Compose: ${COMPOSE_FILE}"

# ════════════════════════════════════════════════════
# 🔍 VÉRIFICATIONS PRÉ-DÉPLOIEMENT
# ════════════════════════════════════════════════════

echo "🔍 Vérifications pré-déploiement..."

# Vérifier les fichiers requis
REQUIRED_FILES=(".env.${ENVIRONMENT}" "docker-compose.prod.yml" "Dockerfile")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Fichier manquant: $file"
        exit 1
    fi
done

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

echo "✅ Vérifications réussies"

# ════════════════════════════════════════════════════
# 🧪 TESTS
# ════════════════════════════════════════════════════

echo "🧪 Exécution des tests..."
pnpm test || {
    echo "❌ Tests échoués - Arrêt du déploiement"
    exit 1
}
echo "✅ Tests réussis"

# ════════════════════════════════════════════════════
# 🏗️ BUILD DES IMAGES
# ════════════════════════════════════════════════════

echo "🏗️ Build des images Docker..."

# Build avec cache
docker build --target control-api -t helpdeskly/control-api:${VERSION} .
docker build --target app-api -t helpdeskly/app-api:${VERSION} .

# Tag latest
docker tag helpdeskly/control-api:${VERSION} helpdeskly/control-api:latest
docker tag helpdeskly/app-api:${VERSION} helpdeskly/app-api:latest

echo "✅ Images buildées avec succès"

# ════════════════════════════════════════════════════
# 🗄️ MIGRATIONS BASE DE DONNÉES
# ════════════════════════════════════════════════════

echo "🗄️ Migrations des bases de données..."

# Démarrer seulement postgres pour les migrations
docker-compose -f ${COMPOSE_FILE} up -d postgres
sleep 10

# Migration Control DB
echo "📊 Migration Control Database..."
docker-compose -f ${COMPOSE_FILE} run --rm control-api \
    npx prisma migrate deploy --schema=prisma/control/schema.prisma

echo "✅ Migrations terminées"

# ════════════════════════════════════════════════════
# 🚢 DÉPLOIEMENT
# ════════════════════════════════════════════════════

echo "🚢 Déploiement des services..."

# Déploiement avec zéro downtime
docker-compose -f ${COMPOSE_FILE} up -d --remove-orphans

echo "⏳ Attente du démarrage des services..."
sleep 30

# ════════════════════════════════════════════════════
# 🏥 HEALTH CHECKS
# ════════════════════════════════════════════════════

echo "🏥 Vérification de la santé des services..."

# Function pour health check avec retry
check_health() {
    local url=$1
    local service_name=$2
    local max_attempts=5
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f --silent --max-time 10 "${url}" > /dev/null; then
            echo "✅ ${service_name}: OK"
            return 0
        fi
        echo "⏳ ${service_name}: Tentative ${attempt}/${max_attempts}..."
        sleep 10
        ((attempt++))
    done

    echo "❌ ${service_name}: ÉCHEC après ${max_attempts} tentatives"
    return 1
}

# Health checks
check_health "http://localhost:6500/health" "Control API"
check_health "http://localhost:6501/health" "App API"

# ════════════════════════════════════════════════════
# 🧹 NETTOYAGE
# ════════════════════════════════════════════════════

echo "🧹 Nettoyage des images orphelines..."
docker image prune -f

# ════════════════════════════════════════════════════
# 🎉 SUCCÈS
# ════════════════════════════════════════════════════

echo ""
echo "🎉 Déploiement terminé avec succès!"
echo ""
echo "📊 URLs des services:"
echo "🎛️  Control API: http://localhost:6500"
echo "🎫  App API: http://localhost:6501"
echo "🗄️  PgAdmin: http://localhost:5050 (avec --profile tools)"
echo ""
echo "📋 Version déployée: ${VERSION}"
echo "📋 Logs: docker-compose -f ${COMPOSE_FILE} logs -f"
```

### 📄 `scripts/rollback.sh`

```bash
#!/bin/bash
# ════════════════════════════════════════════════════
# ↩️ SCRIPT DE ROLLBACK
# ════════════════════════════════════════════════════

set -e

PREVIOUS_VERSION=${1}
COMPOSE_FILE="docker-compose.prod.yml"

if [ -z "$PREVIOUS_VERSION" ]; then
    echo "❌ Usage: ./rollback.sh <previous_version>"
    echo "💡 Exemple: ./rollback.sh abc123"
    exit 1
fi

echo "↩️ Rollback vers la version: ${PREVIOUS_VERSION}"

# Vérifier que l'image existe
if ! docker image inspect helpdeskly/control-api:${PREVIOUS_VERSION} >/dev/null 2>&1; then
    echo "❌ Image helpdeskly/control-api:${PREVIOUS_VERSION} introuvable"
    exit 1
fi

# Tag des images previous vers latest
docker tag helpdeskly/control-api:${PREVIOUS_VERSION} helpdeskly/control-api:latest
docker tag helpdeskly/app-api:${PREVIOUS_VERSION} helpdeskly/app-api:latest

# Redéploiement
docker-compose -f ${COMPOSE_FILE} up -d --force-recreate control-api app-api

echo "✅ Rollback terminé vers ${PREVIOUS_VERSION}"
```

---

## 🚀 Commandes de Déploiement

### Développement Local

```bash
# Démarrer tous les services de développement
docker-compose up -d

# Démarrer seulement l'infrastructure
docker-compose up -d postgres redis pgbouncer

# Démarrer avec PgAdmin
docker-compose --profile tools up -d
```

### Production

```bash
# Déploiement complet
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# Déploiement avec Nginx
docker-compose --profile proxy up -d

# Monitoring des logs
docker-compose -f docker-compose.prod.yml logs -f

# Rollback
./scripts/rollback.sh abc123
```

### Maintenance

```bash
# Backup base de données
docker exec helpdeskly-postgres pg_dump -U helpdeskly_user helpdeskly_control > backup.sql

# Monitoring des performances
docker stats

# Nettoyage
docker system prune -a -f
```

---

## 📊 Monitoring et Métriques

### Health Checks Disponibles

- **Control API**: `http://localhost:6500/health`
- **App API**: `http://localhost:6501/health`
- **PostgreSQL**: Automatique via Docker
- **Redis**: Automatique via Docker

### Logs Centralisés

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f control-api
docker-compose logs -f app-api
```

---

## 🔒 Sécurité Production

### ✅ Checklist Sécurité

- [ ] **JWT_SECRET** changé en production
- [ ] **Mots de passe DB** sécurisés
- [ ] **CORS** configuré correctement
- [ ] **Rate limiting** activé
- [ ] **HTTPS** configuré (via reverse proxy)
- [ ] **Headers de sécurité** ajoutés
- [ ] **Swagger** désactivé en production
- [ ] **Logs** configurés niveau INFO
- [ ] **Backups** automatisés
- [ ] **Monitoring** mis en place

\*\*🎯 Ton application multi-tenant est maintenant prête pour la production
