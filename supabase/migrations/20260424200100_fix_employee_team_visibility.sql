-- Allow employees to see all appointment_employees rows for appointments they are assigned to
-- (not just their own row). Uses get_employee_appointment_ids() SECURITY DEFINER to avoid recursion.
DROP POLICY IF EXISTS "Employee select own assignments" ON public.appointment_employees;

CREATE POLICY "Employee select team assignments"
    ON public.appointment_employees
    FOR SELECT
    TO authenticated
    USING (
        (select public.get_user_role()) = 'admin'
        OR appointment_id IN (SELECT public.get_employee_appointment_ids())
    );

-- Allow employees to see other active, non-archived employees (needed for team display)
DROP POLICY IF EXISTS "Employee select own record" ON public.employees;

CREATE POLICY "Employee select active employees"
    ON public.employees
    FOR SELECT
    TO authenticated
    USING (
        (select public.get_user_role()) = 'admin'
        OR (is_active = true AND NOT is_archived)
    );
