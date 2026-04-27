CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

CREATE TABLE public.employees (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
	full_name TEXT NOT NULL,
	phone TEXT,
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false
);

CREATE TABLE public.clients (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	email TEXT,
	phone TEXT,
	address TEXT,
	notes TEXT,
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false
);

CREATE TABLE public.jobs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	description TEXT,
	base_price_cents INTEGER NOT NULL,
	estimated_duration_minutes INTEGER,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false
);

CREATE TABLE public.recurrence_series (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	frequency TEXT NOT NULL,
	start_date DATE NOT NULL,
	end_date DATE,
	max_occurrences INTEGER,
	client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
	job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false,
	CONSTRAINT recurrence_series_frequency_check CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly'))
);

CREATE TABLE public.appointments (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
	job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
	recurrence_series_id UUID REFERENCES public.recurrence_series(id) ON DELETE SET NULL,
	scheduled_date DATE NOT NULL,
	scheduled_start_time TIME NOT NULL,
	scheduled_end_time TIME NOT NULL,
	price_override_cents INTEGER,
	status TEXT NOT NULL DEFAULT 'scheduled',
	notes TEXT,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false,
	CONSTRAINT appointments_status_check CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'))
);

CREATE TABLE public.appointment_employees (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
	employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
	clocked_in_at TIMESTAMPTZ,
	clocked_out_at TIMESTAMPTZ,
	admin_notes TEXT,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false
);

CREATE TABLE public.invoices (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'draft',
	issued_date DATE,
	due_date DATE,
	total_cents INTEGER NOT NULL,
	notes TEXT,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN DEFAULT false,
	CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'issued', 'paid', 'void'))
);

CREATE TABLE public.invoice_appointments (
	invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
	appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
	PRIMARY KEY (invoice_id, appointment_id)
);

CREATE INDEX idx_recurrence_series_client_id ON public.recurrence_series (client_id);
CREATE INDEX idx_recurrence_series_job_id ON public.recurrence_series (job_id);

CREATE INDEX idx_appointments_client_id ON public.appointments (client_id);
CREATE INDEX idx_appointments_job_id ON public.appointments (job_id);
CREATE INDEX idx_appointments_recurrence_series_id ON public.appointments (recurrence_series_id);
CREATE INDEX idx_appointments_scheduled_date ON public.appointments (scheduled_date);
CREATE INDEX idx_appointments_status ON public.appointments (status);

CREATE INDEX idx_appointment_employees_appointment_id ON public.appointment_employees (appointment_id);
CREATE INDEX idx_appointment_employees_employee_id ON public.appointment_employees (employee_id);

CREATE INDEX idx_invoices_client_id ON public.invoices (client_id);
CREATE INDEX idx_invoices_status ON public.invoices (status);

CREATE INDEX idx_invoice_appointments_invoice_id ON public.invoice_appointments (invoice_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.employees
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.clients
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.jobs
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.recurrence_series
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.appointments
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.appointment_employees
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.invoices
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
	BEFORE UPDATE ON public.invoice_appointments
	FOR EACH ROW
	EXECUTE FUNCTION public.set_updated_at();
