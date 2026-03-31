interface DealRiskBadgeProps {
  level: 'healthy' | 'watch' | 'critical' | null;
  reason?: string;
}

export function DealRiskBadge({ level, reason }: DealRiskBadgeProps) {
  if (!level) return <div className='w-2 h-2 rounded-full bg-muted flex-shrink-0' />;
  const config = {
    healthy: { color: 'bg-signal', label: 'Sain' },
    watch:   { color: 'bg-warning', label: 'À surveiller' },
    critical:{ color: 'bg-destructive', label: 'En danger' },
  }[level];
  return (
    <div className='relative group/badge flex-shrink-0'>
      <div className={`w-2.5 h-2.5 rounded-full ${config.color}`}
        style={level === 'critical' ? {animation: 'pulse 2s infinite'} : {}} />
      <div className='absolute left-4 top-1/2 -translate-y-1/2 hidden group-hover/badge:block
        z-10 bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-md
        whitespace-nowrap border'>
        {config.label}{reason ? ` — ${reason}` : ''}
      </div>
    </div>
  );
}
