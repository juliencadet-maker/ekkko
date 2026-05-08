interface Props {
  companyDisplayName?: string | null;
}

/**
 * Phase 1d — Greeting V1.5.
 * "Bonjour l'équipe {company}" si dispo, sinon "Bonjour".
 */
export function DealRoomGreeting({ companyDisplayName }: Props) {
  const message = companyDisplayName
    ? `Bonjour l'équipe ${companyDisplayName}`
    : "Bonjour";

  return (
    <h1 className="font-sans text-3xl md:text-4xl font-medium text-foreground tracking-tight">
      {message}
    </h1>
  );
}
