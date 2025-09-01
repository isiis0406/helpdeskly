// ════════════════════════════════════════════════════
// 💳 CONFIGURATION DES PLANS
// ════════════════════════════════════════════════════

export interface PlanFeature {
  key: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PlanLimits {
  users: number;
  tickets: number;
  storage: number; // MB
  apiCalls: number; // per month
  comments: number;
}

export interface PlanConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  limits: PlanLimits;
  features: PlanFeature[];
  stripe: {
    productId: string;
    priceIdMonthly: string;
    priceIdYearly: string;
  };
  isPopular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export const PLANS_CONFIG: PlanConfig[] = [
  {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    description: 'Parfait pour les petites équipes qui démarrent',
    priceMonthly: 29,
    priceYearly: 290, // 2 mois gratuits
    currency: 'EUR',
    limits: {
      users: 5,
      tickets: 1000,
      storage: 1000, // 1GB
      apiCalls: 10000,
      comments: 5000,
    },
    stripe: {
      productId: 'prod_starter_helpdeskly',
      priceIdMonthly: 'price_starter_monthly',
      priceIdYearly: 'price_starter_yearly',
    },
    isActive: true,
    sortOrder: 1,
    features: [
      {
        key: 'tickets',
        name: 'Tickets mensuels',
        description: '1,000 tickets par mois',
        included: true,
        limit: 1000,
      },
      {
        key: 'users',
        name: 'Utilisateurs',
        description: "Jusqu'à 5 agents et clients",
        included: true,
        limit: 5,
      },
      {
        key: 'email_support',
        name: 'Support email',
        description: 'Support par email uniquement',
        included: true,
      },
      {
        key: 'basic_reports',
        name: 'Rapports de base',
        description: 'Statistiques essentielles',
        included: true,
      },
      {
        key: 'api_access',
        name: 'Accès API',
        description: 'API REST limitée',
        included: false,
      },
      {
        key: 'custom_domain',
        name: 'Domaine personnalisé',
        description: 'Sous-domaine personnalisé',
        included: false,
      },
      {
        key: 'sso',
        name: 'Single Sign-On',
        description: 'Authentification SAML/OIDC',
        included: false,
      },
    ],
  },
  {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    description: 'Pour les équipes en croissance avec des besoins avancés',
    priceMonthly: 79,
    priceYearly: 790, // 2 mois gratuits
    currency: 'EUR',
    limits: {
      users: 25,
      tickets: -1, // Illimité
      storage: 10000, // 10GB
      apiCalls: 100000,
      comments: -1, // Illimité
    },
    stripe: {
      productId: 'prod_professional_helpdeskly',
      priceIdMonthly: 'price_pro_monthly',
      priceIdYearly: 'price_pro_yearly',
    },
    isPopular: true,
    isActive: true,
    sortOrder: 2,
    features: [
      {
        key: 'tickets',
        name: 'Tickets illimités',
        description: 'Aucune limite sur les tickets',
        included: true,
        limit: -1,
      },
      {
        key: 'users',
        name: 'Utilisateurs étendus',
        description: "Jusqu'à 25 agents et clients illimités",
        included: true,
        limit: 25,
      },
      {
        key: 'priority_support',
        name: 'Support prioritaire',
        description: 'Support email et chat prioritaire',
        included: true,
      },
      {
        key: 'advanced_reports',
        name: 'Rapports avancés',
        description: 'Analytics détaillées et exports',
        included: true,
      },
      {
        key: 'api_access',
        name: 'Accès API complet',
        description: 'API REST complète avec rate limiting élevé',
        included: true,
      },
      {
        key: 'custom_domain',
        name: 'Domaine personnalisé',
        description: 'helpdesk.votre-domaine.com',
        included: true,
      },
      {
        key: 'automations',
        name: 'Automatisations',
        description: 'Workflows et règles automatiques',
        included: true,
      },
      {
        key: 'integrations',
        name: 'Intégrations avancées',
        description: 'Slack, Teams, Zapier, etc.',
        included: true,
      },
      {
        key: 'sso',
        name: 'Single Sign-On',
        description: 'Authentification SAML/OIDC',
        included: false,
      },
    ],
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Solution complète pour les grandes organisations',
    priceMonthly: 199,
    priceYearly: 1990, // 2 mois gratuits
    currency: 'EUR',
    limits: {
      users: -1, // Illimité
      tickets: -1, // Illimité
      storage: 100000, // 100GB
      apiCalls: -1, // Illimité
      comments: -1, // Illimité
    },
    stripe: {
      productId: 'prod_enterprise_helpdeskly',
      priceIdMonthly: 'price_enterprise_monthly',
      priceIdYearly: 'price_enterprise_yearly',
    },
    isActive: true,
    sortOrder: 3,
    features: [
      {
        key: 'everything_pro',
        name: 'Tout de Professional +',
        description: 'Toutes les fonctionnalités Professional incluses',
        included: true,
      },
      {
        key: 'unlimited_everything',
        name: 'Tout illimité',
        description: 'Utilisateurs, tickets, storage, API calls',
        included: true,
        limit: -1,
      },
      {
        key: 'dedicated_support',
        name: 'Support dédié',
        description: 'Account manager et support téléphonique 24/7',
        included: true,
      },
      {
        key: 'sso',
        name: 'Single Sign-On Premium',
        description: 'SAML, OIDC, LDAP, Active Directory',
        included: true,
      },
      {
        key: 'white_label',
        name: 'White Label complet',
        description: "Personnalisation complète de l'interface",
        included: true,
      },
      {
        key: 'advanced_security',
        name: 'Sécurité enterprise',
        description: 'Audit logs, 2FA obligatoire, IP whitelisting',
        included: true,
      },
      {
        key: 'custom_integrations',
        name: 'Intégrations sur mesure',
        description: "Développement d'intégrations personnalisées",
        included: true,
      },
      {
        key: 'sla_guarantee',
        name: 'SLA garantie',
        description: '99.9% uptime avec compensation',
        included: true,
      },
      {
        key: 'onboarding',
        name: 'Onboarding dédié',
        description: 'Formation et mise en place assistée',
        included: true,
      },
    ],
  },
];

// Configuration globale
export const BILLING_CONFIG = {
  FREE_TRIAL_DAYS: 14,
  DEFAULT_PLAN_ID: 'starter',
  GRACE_PERIOD_DAYS: 3, // Période de grâce après échéance
  CURRENCY: 'EUR',
  TAX_RATE: 0.2, // 20% TVA par défaut
  WEBHOOK_TOLERANCE: 300, // 5 minutes de tolérance pour les webhooks
};

// Helper functions
export const getPlanConfig = (planId: string): PlanConfig | undefined => {
  return PLANS_CONFIG.find((plan) => plan.id === planId);
};

export const getActivePlans = (): PlanConfig[] => {
  return PLANS_CONFIG.filter((plan) => plan.isActive !== false).sort(
    (a, b) => (a.sortOrder || 999) - (b.sortOrder || 999),
  );
};

export const getPlanLimits = (planId: string): PlanLimits | null => {
  const plan = getPlanConfig(planId);
  return plan ? plan.limits : null;
};

export const isFeatureIncluded = (
  planId: string,
  featureKey: string,
): boolean => {
  const plan = getPlanConfig(planId);
  if (!plan) return false;

  const feature = plan.features.find((f) => f.key === featureKey);
  return feature ? feature.included : false;
};
