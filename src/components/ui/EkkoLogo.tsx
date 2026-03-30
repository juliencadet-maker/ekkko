interface EkkoLogoProps {
  /** Size of the mark in px */
  size?: number;
  /** Show the "Ekko" text next to the mark */
  showText?: boolean;
  /** Text font size in px (default 20) */
  textSize?: number;
  /** Whether context is dark background (true) or light (false) */
  onDark?: boolean;
  /** For favicon usage: simplify nodes (no dashed circle) */
  favicon?: boolean;
  className?: string;
}

export function EkkoLogoMark({ size = 32, favicon = false }: { size?: number; favicon?: boolean }) {
  return (
    <svg width={size} height={size * (54 / 58)} viewBox="0 0 58 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Structure E — buying committee */}
      <line x1="9" y1="6" x2="9" y2="48" stroke="#1AE08A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="9" y1="6" x2="46" y2="6" stroke="#1AE08A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="9" y1="22" x2="38" y2="22" stroke="#1AE08A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="9" y1="48" x2="46" y2="48" stroke="#1AE08A" strokeWidth="2.5" strokeLinecap="round" />
      {/* Nœuds — contacts du buying committee */}
      <circle cx="9" cy="6" r="6.5" fill="#1AE08A" />
      <circle cx="46" cy="6" r="5" fill="#1D2F3F" stroke="#1AE08A" strokeWidth="2" />
      <circle cx="38" cy="22" r="4" fill="#1D2F3F" stroke="#1AE08A" strokeWidth="1.8" opacity="0.8" />
      <circle cx="9" cy="48" r="4" fill="#1D2F3F" stroke="#1AE08A" strokeWidth="1.8" opacity="0.45" />
      <circle cx="46" cy="48" r="5" fill="#1D2F3F" stroke="#1AE08A" strokeWidth="2" opacity="0.6" />
      {/* Nœud pointillé — contact inconnu */}
      {!favicon && (
        <circle cx="54" cy="22" r="3.5" fill="none" stroke="#1AE08A" strokeWidth="1.5" strokeDasharray="2.5 2" opacity="0.55" />
      )}
    </svg>
  );
}

export function EkkoLogo({
  size = 32,
  showText = true,
  textSize = 20,
  onDark = true,
  favicon = false,
  className = "",
}: EkkoLogoProps) {
  const textColor = onDark ? "#F7F6F3" : "#0D1B2A";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <EkkoLogoMark size={size} favicon={favicon} />
      {showText && (
        <span
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: `${textSize}px`,
            letterSpacing: "-0.3px",
            color: textColor,
            lineHeight: 1,
          }}
        >
          Ekko
        </span>
      )}
    </div>
  );
}
