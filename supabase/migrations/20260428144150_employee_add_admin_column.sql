-- Add is_admin flag to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Mark your admin employee
UPDATE public.employees
SET is_admin = true
WHERE user_id = '<your-admin-user-id>';

-- Update get_user_role() to check the DB as a fallback
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN 'admin'
    ELSE 'employee'
  END;
$$;