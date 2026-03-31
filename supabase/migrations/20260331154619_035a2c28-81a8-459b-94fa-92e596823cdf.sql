
-- Add is_approved column to profiles (existing users get true, new users get false)
ALTER TABLE public.profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Approve all existing users
UPDATE public.profiles SET is_approved = true;

-- Update the handle_user_signup function to explicitly set is_approved = false
CREATE OR REPLACE FUNCTION public.handle_user_signup(p_user_id uuid, p_email text, p_org_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_org_slug text;
  v_profile_id uuid;
BEGIN
  v_org_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_org_slug := regexp_replace(v_org_slug, '-+', '-', 'g');
  v_org_slug := v_org_slug || '-' || floor(extract(epoch from now()))::text;
  
  INSERT INTO public.orgs (name, slug)
  VALUES (p_org_name, v_org_slug)
  RETURNING id INTO v_org_id;
  
  INSERT INTO public.org_memberships (org_id, user_id, role, is_active)
  VALUES (v_org_id, p_user_id, 'org_owner', true);
  
  INSERT INTO public.policies (org_id)
  VALUES (v_org_id);
  
  INSERT INTO public.providers (org_id, name, provider_type, is_active)
  VALUES (v_org_id, 'MockProvider', 'mock', true);
  
  INSERT INTO public.profiles (user_id, email, onboarding_completed, onboarding_step, is_approved)
  VALUES (p_user_id, p_email, false, 0, false)
  RETURNING id INTO v_profile_id;
  
  RETURN json_build_object(
    'org_id', v_org_id,
    'profile_id', v_profile_id,
    'success', true
  );
END;
$function$;
