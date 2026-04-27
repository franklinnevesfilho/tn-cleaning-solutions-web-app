ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurrence_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_appointments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
	SELECT COALESCE(
		auth.jwt() -> 'app_metadata' ->> 'role',
		'employee'
	)::TEXT;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
	SELECT id
	FROM public.employees
	WHERE user_id = auth.uid();
$$;

CREATE POLICY "Admin full access on employees"
	ON public.employees
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Employee select own record"
	ON public.employees
	FOR SELECT
	TO authenticated
	USING (user_id = auth.uid());

CREATE POLICY "Admin full access on clients"
	ON public.clients
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Employee select clients"
	ON public.clients
	FOR SELECT
	TO authenticated
	USING (NOT is_archived);

CREATE POLICY "Admin full access on jobs"
	ON public.jobs
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Employee select jobs"
	ON public.jobs
	FOR SELECT
	TO authenticated
	USING (NOT is_archived);

CREATE POLICY "Admin full access on recurrence_series"
	ON public.recurrence_series
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin full access on appointments"
	ON public.appointments
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Employee select assigned appointments"
	ON public.appointments
	FOR SELECT
	TO authenticated
	USING (
		id IN (
			SELECT appointment_id
			FROM public.appointment_employees
			WHERE employee_id = (select public.get_employee_id())
		)
	);

CREATE POLICY "Admin full access on appointment_employees"
	ON public.appointment_employees
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Employee select own assignments"
	ON public.appointment_employees
	FOR SELECT
	TO authenticated
	USING (employee_id = (select public.get_employee_id()));

CREATE POLICY "Employee update own clock times"
	ON public.appointment_employees
	FOR UPDATE
	TO authenticated
	USING (employee_id = (select public.get_employee_id()))
	WITH CHECK (employee_id = (select public.get_employee_id()));

CREATE POLICY "Admin full access on invoices"
	ON public.invoices
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin full access on invoice_appointments"
	ON public.invoice_appointments
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');
