// =============================================
// EKKO - Application Constants
// =============================================

export const APP_NAME = "Ekko";
export const APP_DESCRIPTION = "Scalez la présence exécutive sur chaque deal. Sécurisez votre revenue.";

// Onboarding
export const ONBOARDING_STEPS = [
  { id: 1, label: "Bienvenue", key: "welcome" },
  { id: 2, label: "Profil", key: "profile" },
  { id: 3, label: "Vidéo de référence", key: "facecam" },
  { id: 4, label: "Identité", key: "identity" },
  { id: 5, label: "Terminé", key: "complete" },
] as const;

// Video Recording
export const VIDEO_CONSTRAINTS = {
  MIN_DURATION_SECONDS: 30,
  MAX_DURATION_SECONDS: 90,
  RECOMMENDED_DURATION_SECONDS: 60,
} as const;

export const SUGGESTED_SCRIPT = `Bonjour, je suis [votre prénom] [votre nom].

Je travaille chez [votre entreprise] en tant que [votre fonction].

Je suis ravi(e) de pouvoir créer des vidéos personnalisées avec Ekko pour mieux communiquer avec mes clients et partenaires.

Merci de votre attention !`;

// Identity Types
export const IDENTITY_TYPES = [
  { value: "executive", label: "Dirigeant(e)" },
  { value: "sales_rep", label: "Commercial(e)" },
  { value: "hr", label: "Ressources Humaines" },
  { value: "marketing", label: "Marketing" },
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
  campaign_created: "Campagne créée",
  campaign_updated: "Campagne modifiée",
  campaign_submitted: "Campagne soumise",
  campaign_approved: "Campagne approuvée",
  campaign_rejected: "Campagne refusée",
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
