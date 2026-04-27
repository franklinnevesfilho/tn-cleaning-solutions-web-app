-- Drop the recursive policy created in 20260424195000.
-- "Employee select team assignments" (from 20260424200100) is the correct replacement.
DROP POLICY IF EXISTS "Employee select assignments for their appointments" ON public.appointment_employees;