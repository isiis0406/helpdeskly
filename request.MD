# 🚀 API Testing Guide - Helpdeskly Multitenant

## 📋 **Table des Matières**

1. [Variables d'Environnement](#variables-denvironnement)
2. [Control API - Gestion des Tenants](#control-api---gestion-des-tenants)
3. [App API - Gestion des Tickets](#app-api---gestion-des-tickets)
4. [Tests de Validation](#tests-de-validation)
5. [Scénarios Complets](#scénarios-complets)

---

## 🔧 **Variables d'Environnement**

```bash
# URLs des APIs
export CONTROL_API_URL="http://localhost:6500"
export APP_API_URL="http://localhost:3000"

# IDs de test (à remplacer par les vrais IDs)
export TENANT_ID="cm..."
export USER_ID_1="cm..."
export USER_ID_2="cm..."
export TICKET_ID="cm..."
```

---

## 🏢 **Control API - Gestion des Tenants**

### **1. Créer un Tenant**

```bash
# ✅ Création réussie
curl -X POST $CONTROL_API_URL/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Corporation",
    "slug": "acme-corp",
    "trialDays": 30
  }'

# ✅ Création avec données minimales
curl -X POST $CONTROL_API_URL/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Tech Startup",
    "slug": "tech-startup"
  }'

# ❌ Test erreur - Slug déjà existant
curl -X POST $CONTROL_API_URL/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Duplicate Corp",
    "slug": "acme-corp"
  }'

# ❌ Test erreur - Slug invalide
curl -X POST $CONTROL_API_URL/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Invalid Corp",
    "slug": "INVALID_SLUG"
  }'

# ❌ Test erreur - Slug réservé
curl -X POST $CONTROL_API_URL/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Admin Panel",
    "slug": "admin"
  }'
```

### **2. Lister les Tenants**

```bash
# ✅ Tous les tenants
curl -X GET $CONTROL_API_URL/tenants

# ✅ Tenant spécifique par ID
curl -X GET $CONTROL_API_URL/tenants/$TENANT_ID

# ✅ Tenant par slug (si endpoint existe)
curl -X GET $CONTROL_API_URL/tenants/slug/acme-corp
```

### **3. Mise à Jour des Tenants**

```bash
# ✅ Mettre à jour le statut
curl -X PATCH $CONTROL_API_URL/tenants/$TENANT_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE"
  }'

# ✅ Suspendre un tenant
curl -X PATCH $CONTROL_API_URL/tenants/$TENANT_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUSPENDED"
  }'
```

---

## 🎫 **App API - Gestion des Tickets**

### **Headers Requis pour App API**

```bash
# Headers pour identifier le tenant (selon votre implémentation)
export TENANT_HEADERS="-H 'X-Tenant-Slug: acme-corp' -H 'Content-Type: application/json'"
# OU
export TENANT_HEADERS="-H 'Host: acme-corp.localhost:3000' -H 'Content-Type: application/json'"
```

### **1. Créer des Tickets**

```bash
# ✅ Ticket simple
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "Impossible de se connecter",
    "description": "Je n'\''arrive pas à me connecter à mon compte depuis ce matin. Le message d'\''erreur indique que mon mot de passe est incorrect.",
    "authorId": "'$USER_ID_1'",
    "priority": "HIGH"
  }'

# ✅ Ticket avec assignation
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "Demande de nouvelle fonctionnalité",
    "description": "Serait-il possible d'\''ajouter un système de notifications par email ?",
    "authorId": "'$USER_ID_1'",
    "assignedToId": "'$USER_ID_2'",
    "priority": "MEDIUM",
    "status": "OPEN"
  }'

# ✅ Ticket urgent
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "🚨 Serveur down - Production",
    "description": "Le serveur de production ne répond plus depuis 10 minutes. Les clients ne peuvent plus accéder au service.",
    "authorId": "'$USER_ID_2'",
    "priority": "URGENT",
    "status": "OPEN"
  }'

# ❌ Test erreur - Utilisateur inexistant
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "Test avec utilisateur invalide",
    "description": "Ce ticket devrait échouer",
    "authorId": "user_inexistant_123",
    "priority": "LOW"
  }'

# ❌ Test erreur - Données manquantes
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "description": "Titre manquant",
    "authorId": "'$USER_ID_1'"
  }'
```

### **2. Consulter les Tickets**

```bash
# ✅ Tous les tickets du tenant
curl -X GET $APP_API_URL/tickets \
  $TENANT_HEADERS

# ✅ Ticket spécifique
curl -X GET $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS

# ❌ Test erreur - Ticket inexistant
curl -X GET $APP_API_URL/tickets/ticket_inexistant_123 \
  $TENANT_HEADERS
```

### **3. Modifier des Tickets**

```bash
# ✅ Changer le statut
curl -X PUT $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS \
  -d '{
    "status": "IN_PROGRESS"
  }'

# ✅ Assigner le ticket
curl -X PUT $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS \
  -d '{
    "assignedToId": "'$USER_ID_2'",
    "status": "IN_PROGRESS"
  }'

# ✅ Changer la priorité
curl -X PUT $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS \
  -d '{
    "priority": "HIGH",
    "title": "🔥 Urgent - Impossible de se connecter"
  }'

# ✅ Résoudre le ticket
curl -X PUT $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS \
  -d '{
    "status": "RESOLVED",
    "description": "Problème résolu après réinitialisation du mot de passe."
  }'
```

### **4. Supprimer des Tickets**

```bash
# ✅ Supprimer un ticket
curl -X DELETE $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS

# ❌ Test erreur - Ticket déjà supprimé
curl -X DELETE $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS
```

---

## 💬 **Gestion des Commentaires** (Si implémenté)

### **1. Ajouter des Commentaires**

```bash
# ✅ Commentaire simple
curl -X POST $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS \
  -d '{
    "body": "J'\''ai essayé de redémarrer mon ordinateur mais le problème persiste.",
    "authorId": "'$USER_ID_1'"
  }'

# ✅ Commentaire de support
curl -X POST $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS \
  -d '{
    "body": "Pouvez-vous me confirmer votre adresse email et la dernière fois que vous avez pu vous connecter ?",
    "authorId": "'$USER_ID_2'"
  }'

# ✅ Commentaire de résolution
curl -X POST $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS \
  -d '{
    "body": "✅ Problème résolu ! J'\''ai réinitialisé votre mot de passe. Vous devriez recevoir un email avec les instructions.",
    "authorId": "'$USER_ID_2'"
  }'
```

### **2. Consulter les Commentaires**

```bash
# ✅ Tous les commentaires d'un ticket
curl -X GET $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS

# ✅ Commentaire spécifique
curl -X GET $APP_API_URL/comments/$COMMENT_ID \
  $TENANT_HEADERS
```

---

## 🧪 **Tests de Validation**

### **1. Tests de Sécurité Multi-Tenant**

```bash
# ❌ Essayer d'accéder aux tickets d'un autre tenant
curl -X GET $APP_API_URL/tickets \
  -H 'X-Tenant-Slug: autre-tenant' \
  -H 'Content-Type: application/json'

# ❌ Créer un ticket avec un utilisateur d'un autre tenant
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "Test sécurité",
    "description": "Tentative avec utilisateur externe",
    "authorId": "utilisateur_autre_tenant",
    "priority": "LOW"
  }'
```

### **2. Tests de Performance**

```bash
# 📊 Créer plusieurs tickets rapidement
for i in {1..10}; do
  curl -X POST $APP_API_URL/tickets \
    $TENANT_HEADERS \
    -d "{
      \"title\": \"Ticket de test $i\",
      \"description\": \"Description du ticket numéro $i pour tester les performances\",
      \"authorId\": \"$USER_ID_1\",
      \"priority\": \"LOW\"
    }" &
done
wait

# 📊 Récupérer tous les tickets
time curl -X GET $APP_API_URL/tickets $TENANT_HEADERS
```

### **3. Tests de Robustesse**

```bash
# ❌ Données invalides
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "",
    "description": null,
    "authorId": 123,
    "priority": "INVALID"
  }'

# ❌ JSON malformé
curl -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{"title": "Test malformé", "description":'

# ❌ Headers manquants
curl -X POST $APP_API_URL/tickets \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Test sans tenant",
    "description": "Ce ticket devrait échouer",
    "authorId": "'$USER_ID_1'"
  }'
```

---

## 🎬 **Scénarios Complets**

### **Scénario 1 : Cycle de Vie Complet d'un Tenant**

```bash
#!/bin/bash
echo "🚀 Création d'un nouveau tenant..."

# 1. Créer le tenant
TENANT_RESPONSE=$(curl -s -X POST $CONTROL_API_URL/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Demo Company",
    "slug": "demo-company"
  }')

echo "Tenant créé: $TENANT_RESPONSE"

# 2. Attendre le provisioning (30 secondes)
echo "⏳ Attente du provisioning..."
sleep 30

# 3. Vérifier le statut
echo "🔍 Vérification du statut..."
curl -s -X GET $CONTROL_API_URL/tenants \
  | jq '.[] | select(.slug == "demo-company")'
```

### **Scénario 2 : Workflow Support Client**

```bash
#!/bin/bash
export TENANT_HEADERS="-H 'X-Tenant-Slug: demo-company' -H 'Content-Type: application/json'"

echo "🎫 Simulation d'un workflow support..."

# 1. Client crée un ticket
echo "1️⃣ Client signale un problème..."
TICKET_RESPONSE=$(curl -s -X POST $APP_API_URL/tickets \
  $TENANT_HEADERS \
  -d '{
    "title": "Problème de synchronisation",
    "description": "Mes données ne se synchronisent plus depuis hier.",
    "authorId": "'$USER_ID_1'",
    "priority": "MEDIUM"
  }')

TICKET_ID=$(echo $TICKET_RESPONSE | jq -r '.id')
echo "Ticket créé: $TICKET_ID"

# 2. Support prend en charge
echo "2️⃣ Support prend en charge..."
curl -s -X PUT $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS \
  -d '{
    "assignedToId": "'$USER_ID_2'",
    "status": "IN_PROGRESS"
  }' | jq '.'

# 3. Ajout d'un commentaire
echo "3️⃣ Demande d'informations..."
curl -s -X POST $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS \
  -d '{
    "body": "Pouvez-vous me dire quel navigateur vous utilisez ?",
    "authorId": "'$USER_ID_2'"
  }' | jq '.'

# 4. Réponse du client
echo "4️⃣ Réponse du client..."
curl -s -X POST $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS \
  -d '{
    "body": "J'\''utilise Chrome version 118.",
    "authorId": "'$USER_ID_1'"
  }' | jq '.'

# 5. Résolution
echo "5️⃣ Résolution du problème..."
curl -s -X PUT $APP_API_URL/tickets/$TICKET_ID \
  $TENANT_HEADERS \
  -d '{
    "status": "RESOLVED"
  }' | jq '.'

curl -s -X POST $APP_API_URL/tickets/$TICKET_ID/comments \
  $TENANT_HEADERS \
  -d '{
    "body": "✅ Problème résolu ! Il y avait un conflit avec une extension Chrome.",
    "authorId": "'$USER_ID_2'"
  }' | jq '.'

echo "✅ Workflow terminé !"
```

### **Scénario 3 : Tests de Charge**

```bash
#!/bin/bash
echo "📊 Tests de charge sur l'API..."

# Créer 50 tickets en parallèle
echo "Création de 50 tickets..."
for i in {1..50}; do
  curl -s -X POST $APP_API_URL/tickets \
    $TENANT_HEADERS \
    -d "{
      \"title\": \"Ticket automatique $i\",
      \"description\": \"Ticket généré automatiquement pour test de charge - $i\",
      \"authorId\": \"$USER_ID_1\",
      \"priority\": \"LOW\"
    }" > /dev/null &
done

wait
echo "✅ 50 tickets créés !"

# Tester la récupération
echo "Test de récupération de tous les tickets..."
time curl -s -X GET $APP_API_URL/tickets $TENANT_HEADERS | jq 'length'
```

---

## 📝 **Notes d'Utilisation**

### **Configuration rapide :**

1. Remplacez les variables `$USER_ID_1`, `$USER_ID_2` par de vrais IDs d'utilisateurs
2. Ajustez les headers selon votre implémentation du routing multi-tenant
3. Vérifiez que les deux APIs sont démarrées

### **Commandes utiles :**

```bash
# Formater les réponses JSON
curl ... | jq '.'

# Sauvegarder les réponses
curl ... > response.json

# Mesurer le temps de réponse
time curl ...

# Tests en parallèle
curl ... &
```

### **Debugging :**

```bash
# Verbose pour voir les headers
curl -v ...

# Sauvegarder les headers de réponse
curl -D headers.txt ...

# Suivre les redirections
curl -L ...
```

---

🎯 **Ce fichier couvre tous les aspects de test de votre API multitenant !**
