-- Create a function to handle new user signup atomically
-- This bypasses RLS issues by using SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.handle_user_signup(
  p_user_id uuid,
  p_email text,
  p_org_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_slug text;
  v_profile_id uuid;
BEGIN
  -- Generate org slug
  v_org_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_org_slug := regexp_replace(v_org_slug, '-+', '-', 'g');
  v_org_slug := v_org_slug || '-' || floor(extract(epoch from now()))::text;
  
  -- Create organization
  INSERT INTO public.orgs (name, slug)
  VALUES (p_org_name, v_org_slug)
  RETURNING id INTO v_org_id;
  
  -- Create org membership as owner
  INSERT INTO public.org_memberships (org_id, user_id, role, is_active)
  VALUES (v_org_id, p_user_id, 'org_owner', true);
  
  -- Create default policy for org
  INSERT INTO public.policies (org_id)
  VALUES (v_org_id);
  
  -- Create mock provider
  INSERT INTO public.providers (org_id, name, provider_type, is_active)
  VALUES (v_org_id, 'MockProvider', 'mock', true);
  
  -- Create user profile
  INSERT INTO public.profiles (user_id, email, onboarding_completed, onboarding_step)
  VALUES (p_user_id, p_email, false, 0)
  RETURNING id INTO v_profile_id;
  
  RETURN json_build_object(
    'org_id', v_org_id,
    'profile_id', v_profile_id,
    'success', true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_user_signup TO authenticated;