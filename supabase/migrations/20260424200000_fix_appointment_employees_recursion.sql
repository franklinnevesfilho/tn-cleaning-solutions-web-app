CREATE OR REPLACE FUNCTION public.get_employee_appointment_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT appointment_id
    FROM public.appointment_employees
    WHERE employee_id = (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    );
$$;

DROP POLICY IF EXISTS "Employee select assigned appointments" ON public.appointments;

CREATE POLICY "Employee select assigned appointments"
    ON public.appointments
    FOR SELECT
    TO authenticated
    USING (
        (select public.get_user_role()) = 'admin'
        OR id IN (SELECT public.get_employee_appointment_ids())
    );