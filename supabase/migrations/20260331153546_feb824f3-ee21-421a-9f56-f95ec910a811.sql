CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  message TEXT,
  source TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_insert" ON public.waitlist
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_authenticated_select" ON public.waitlist
  FOR SELECT TO authenticated USING (true);