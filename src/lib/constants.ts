// =============================================
// EKKO - Application Constants
// =============================================

export const APP_NAME = "Ekko";
export const APP_DESCRIPTION = "Scalez la présence exécutive sur chaque deal. Sécurisez votre revenue.";

// Onboarding (4 steps now)
export const ONBOARDING_STEPS = [
  { id: 1, label: "Bienvenue", key: "welcome" },
  { id: 2, label: "Profil", key: "profile" },
  { id: 3, label: "Identité", key: "identity" },
  { id: 4, label: "Terminé", key: "complete" },
] as const;

// Video Upload Constraints — aligned with Tavus Phoenix-3 replica requirements
export const VIDEO_CONSTRAINTS = {
  MIN_DURATION_SECONDS: 120,
  MAX_DURATION_SECONDS: 300,
  SPEAKING_PHASE_SECONDS: 60,
  LISTENING_PHASE_SECONDS: 60,
  RECOMMENDED_DURATION_SECONDS: 120,
  MAX_FILE_SIZE_MB: 750,
  MIN_RESOLUTION_HEIGHT: 1080,
  MIN_FPS: 25,
} as const;

// Tavus consent statement
export const TAVUS_CONSENT_SCRIPT_EN = `I, [YOUR FULL NAME], am currently speaking and give consent to Tavus to create an AI clone of me by using the audio and video samples I provide. I understand that this AI clone can be used to create videos that look and sound like me.`;

export const TAVUS_SPEAKING_SCRIPT_FR = `Bonjour, je m'appelle [votre prénom] [votre nom].

Je travaille chez [votre entreprise] en tant que [votre fonction].

Je fais cet enregistrement car bientôt je serai en mesure de créer plus de confiance sur le cycle de vente, tout en gagnant du temps.

Je pourrai également être présent sur tous les deals sans avoir à bloquer mon agenda.

Cela me permettra d'impliquer des personnes plus facilement, afin de créer plus de confiance et d'engagement avec mes clients et partenaires.

Avec Ekko, je vais pouvoir personnaliser mes messages vidéo pour chaque prospect, et ainsi augmenter significativement mes taux de conversion.

Merci de votre attention !`;

export const SUGGESTED_SCRIPT = `Bonjour, je suis [votre prénom] [votre nom].

Je travaille chez [votre entreprise] en tant que [votre fonction].

Je suis ravi(e) de pouvoir créer des vidéos personnalisées avec Ekko pour mieux communiquer avec mes clients et partenaires.

Merci de votre attention !`;

// Identity Types — updated terminology
export const IDENTITY_TYPES = [
  { value: "executive", label: "Exec clone" },
  { value: "sales_rep", label: "AE facecam" },
  { value: "hr", label: "RH clone" },
  { value: "marketing", label: "Marketing clone" },
  { value: "other", label: "Autre" },
] as const;

// Campaign Status Labels (French)
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_approval: "En attente de validation",
  approved: "Approuvé",
  generating: "Génération en cours",
  completed: "Terminé",
  cancelled: "Annulé",
} as const;

// Approval Status Labels (French)
export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
} as const;

// Role Labels (French)
export const ROLE_LABELS: Record<string, string> = {
  org_owner: "Propriétaire",
  org_admin: "Administrateur",
  org_manager: "Manager",
  org_user: "Utilisateur",
} as const;

// Deal Stages
export const DEAL_STAGES = [
  { value: "qualification", label: "Qualification" },
  { value: "rfp", label: "RFP" },
  { value: "shortlist", label: "Shortlist" },
  { value: "negotiation", label: "Négociation" },
  { value: "close", label: "Close" },
] as const;

// API Routes
export const API_ROUTES = {
  GENERATE_VIDEO: "/api/generate-video",
  PROCESS_JOBS: "/api/process-jobs",
} as const;

// Storage Paths
export const STORAGE_PATHS = {
  IDENTITY_ASSETS: "identity_assets",
  GENERATED_VIDEOS: "generated_videos",
} as const;

// Audit Event Labels
export const AUDIT_EVENT_LABELS: Record<string, string> = {
  user_signup: "Inscription",
  user_login: "Connexion",
  user_logout: "Déconnexion",
  onboarding_started: "Onboarding démarré",
  onboarding_profile_completed: "Profil complété",
  onboarding_video_recorded: "Vidéo enregistrée",
  onboarding_completed: "Onboarding terminé",
  org_created: "Organisation créée",
  org_member_added: "Membre ajouté",
  org_member_removed: "Membre retiré",
  org_member_role_changed: "Rôle modifié",
  identity_created: "Identité créée",
  identity_updated: "Identité modifiée",
  identity_status_changed: "Statut identité modifié",
  campaign_created: "Deal créé",
  campaign_updated: "Deal modifié",
  campaign_submitted: "Deal soumis",
  campaign_approved: "Deal approuvé",
  campaign_rejected: "Deal refusé",
  video_job_created: "Génération lancée",
  video_job_completed: "Génération terminée",
  video_job_failed: "Génération échouée",
  video_viewed: "Vidéo visionnée",
  video_shared: "Vidéo partagée",
  approval_requested: "Validation demandée",
  approval_approved: "Validation accordée",
  approval_rejected: "Validation refusée",
  policy_updated: "Politique modifiée",
} as const;
