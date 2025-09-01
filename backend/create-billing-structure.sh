#!/bin/bash

BASE_DIR="apps/control-api/src/billing"

# Créer l'arborescence des dossiers
mkdir -p $BASE_DIR/config
mkdir -p $BASE_DIR/services
mkdir -p $BASE_DIR/controllers
mkdir -p $BASE_DIR/dto
mkdir -p $BASE_DIR/guards
mkdir -p $BASE_DIR/processors
mkdir -p $BASE_DIR/interfaces

# Créer le module
touch $BASE_DIR/billing.module.ts

# Config
touch $BASE_DIR/config/plans.config.ts
touch $BASE_DIR/config/stripe.config.ts

# Services
touch $BASE_DIR/services/stripe.service.ts
touch $BASE_DIR/services/subscription.service.ts
touch $BASE_DIR/services/plan.service.ts
touch $BASE_DIR/services/usage.service.ts
touch $BASE_DIR/services/invoice.service.ts
touch $BASE_DIR/services/webhook.service.ts

# Controllers
touch $BASE_DIR/controllers/plans.controller.ts
touch $BASE_DIR/controllers/subscription.controller.ts
touch $BASE_DIR/controllers/webhook.controller.ts
touch $BASE_DIR/controllers/usage.controller.ts

# DTOs
touch $BASE_DIR/dto/create-subscription.dto.ts
touch $BASE_DIR/dto/update-subscription.dto.ts
touch $BASE_DIR/dto/webhook-event.dto.ts
touch $BASE_DIR/dto/usage-record.dto.ts

# Guards
touch $BASE_DIR/guards/subscription.guard.ts
touch $BASE_DIR/guards/usage-limit.guard.ts

# Processors
touch $BASE_DIR/processors/usage.processor.ts
touch $BASE_DIR/processors/billing.processor.ts

# Interfaces
touch $BASE_DIR/interfaces/billing.interface.ts
touch $BASE_DIR/interfaces/stripe.interface.ts

echo "✅ Structure du module billing créée avec succès dans $BASE_DIR"