CREATE TABLE IF NOT EXISTS public.early_access_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  prenom text NOT NULL,
  nom text NOT NULL,
  email text NOT NULL,
  entreprise text NOT NULL,
  poste text NOT NULL,
  source text DEFAULT 'landing',
  notes text,
  CONSTRAINT early_access_leads_email_unique UNIQUE (email)
);

ALTER TABLE public.early_access_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_select_anon" ON public.early_access_leads
  FOR SELECT USING (false);

CREATE POLICY "deny_insert_anon" ON public.early_access_leads
  FOR INSERT WITH CHECK (false);
