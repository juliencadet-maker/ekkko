import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function MetricCard({ 
  icon: Icon, 
  value, 
  label, 
  trend,
  className,
  onClick,
}: MetricCardProps) {
  return (
    <div 
      className={cn("metric-card", onClick && "cursor-pointer hover:border-primary/40 transition-colors", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="metric-value">{value}</p>
          <p className="metric-label">{label}</p>
        </div>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      {trend && (
        <div className={cn(
          "mt-3 text-sm font-medium",
          trend.isPositive ? "text-success" : "text-destructive"
        )}>
          {trend.isPositive ? "+" : ""}{trend.value}% vs période précédente
        </div>
      )}
    </div>
  );
}
