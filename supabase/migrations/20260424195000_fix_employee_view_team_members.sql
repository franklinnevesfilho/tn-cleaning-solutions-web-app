-- Fix RLS policy to allow employees to see team members on their appointments
-- This allows employees to view all assignments for appointments they are assigned to

DROP POLICY IF EXISTS "Employee select own assignments" ON public.appointment_employees;

CREATE POLICY "Employee select assignments for their appointments"
	ON public.appointment_employees
	FOR SELECT
	TO authenticated
	USING (
		-- Allow employee to see their own assignment
		employee_id = (select public.get_employee_id())
		OR
		-- Allow employee to see other team members on their appointments
		appointment_id IN (
			SELECT appointment_id
			FROM public.appointment_employees
			WHERE employee_id = (select public.get_employee_id())
		)
	);
