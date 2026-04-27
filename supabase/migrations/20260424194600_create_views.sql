CREATE OR REPLACE VIEW public.invoices_with_status
WITH (security_invoker = true)
AS
SELECT
	i.*,
	CASE
		WHEN i.status = 'issued' AND i.due_date < CURRENT_DATE THEN 'overdue'
		ELSE i.status
	END AS effective_status
FROM public.invoices i;

COMMENT ON VIEW public.invoices_with_status IS
	'Invoices with computed effective_status field. Overdue is derived from due_date < today when status = issued.';

CREATE OR REPLACE VIEW public.appointment_employees_employee_view
WITH (security_invoker = true)
AS
SELECT
	id,
	appointment_id,
	employee_id,
	clocked_in_at,
	clocked_out_at,
	created_at,
	updated_at,
	is_archived
FROM public.appointment_employees;

COMMENT ON VIEW public.appointment_employees_employee_view IS
	'Employee-safe view of appointment_employees. Excludes admin_notes column.';
