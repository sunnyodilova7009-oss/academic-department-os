ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'academic_admin';

CREATE OR REPLACE FUNCTION public.is_active_academic_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.active = true
      AND p.role::text = 'academic_admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_academic_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_academic_admin() TO authenticated;
