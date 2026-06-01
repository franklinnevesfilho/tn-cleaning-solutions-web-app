-- supabase/migrations/20260428000000_get_employee_email_function.sql

CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;