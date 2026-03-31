import { cn } from "@/lib/utils";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  FileEdit,
  AlertCircle
} from "lucide-react";

type StatusType = 
  | "draft" 
  | "pending" 
  | "pending_approval"
  | "approved" 
  | "rejected" 
  | "generating" 
  | "completed"
  | "cancelled"
  | "queued"
  | "processing"
  | "failed"
  | "ready"
  | "suspended";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<StatusType, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  draft: {
    label: "Brouillon",
    className: "status-badge-draft",
    icon: FileEdit,
  },
  pending: {
    label: "En attente",
    className: "status-badge-pending",
    icon: Clock,
  },
  pending_approval: {
    label: "Validation requise",
    className: "status-badge-pending",
    icon: Clock,
  },
  approved: {
    label: "Approuvé",
    className: "status-badge-approved",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Refusé",
    className: "status-badge-rejected",
    icon: XCircle,
  },
  generating: {
    label: "Génération...",
    className: "status-badge-generating",
    icon: Loader2,
  },
  completed: {
    label: "Terminé",
    className: "status-badge-completed",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Annulé",
    className: "status-badge-rejected",
    icon: XCircle,
  },
  queued: {
    label: "En file d'attente",
    className: "status-badge-pending",
    icon: Clock,
  },
  processing: {
    label: "En cours",
    className: "status-badge-generating",
    icon: Loader2,
  },
  failed: {
    label: "Échoué",
    className: "status-badge-rejected",
    icon: AlertCircle,
  },
  ready: {
    label: "Prêt",
    className: "status-badge-approved",
    icon: CheckCircle2,
  },
  suspended: {
    label: "Suspendu",
    className: "status-badge-rejected",
    icon: AlertCircle,
  },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;

  const Icon = config.icon;
  const isAnimated = status === "generating" || status === "processing";

  return (
    <span className={cn("status-badge", config.className, className)}>
      {showIcon && (
        <Icon className={cn("w-3.5 h-3.5", isAnimated && "animate-spin")} />
      )}
      {config.label}
    </span>
  );
}
