
-- Harden SECURITY DEFINER functions: only allow calls with auth.uid()
-- Note: These functions are used in RLS policies where auth.uid() is always passed.
-- Adding guards prevents misuse from RPC calls with attacker-controlled IDs.

-- has_org_role: add auth.uid() guard
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _role org_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow RLS policy context (where auth.uid() is the caller)
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = TRUE
  );
END;
$function$;

-- has_min_role_in_org: add auth.uid() guard
CREATE OR REPLACE FUNCTION public.has_min_role_in_org(_user_id uuid, _org_id uuid, _min_role org_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND is_active = TRUE
      AND (
        role = 'org_owner' OR
        (_min_role = 'org_admin' AND role IN ('org_owner', 'org_admin')) OR
        (_min_role = 'org_manager' AND role IN ('org_owner', 'org_admin', 'org_manager')) OR
        (_min_role = 'org_user')
      )
  );
END;
$function$;

-- get_user_org_id: add auth.uid() guard
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT org_id
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND is_active = TRUE
    LIMIT 1
  );
END;
$function$;

-- get_user_role_in_org: add auth.uid() guard
CREATE OR REPLACE FUNCTION public.get_user_role_in_org(_user_id uuid, _org_id uuid)
 RETURNS org_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT role
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND is_active = TRUE
    LIMIT 1
  );
END;
$function$;
