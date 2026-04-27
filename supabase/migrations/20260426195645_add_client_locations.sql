-- Create client_locations table
CREATE TABLE public.client_locations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
	label TEXT NOT NULL DEFAULT 'Location',
	address TEXT NOT NULL,
	notes TEXT,
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ DEFAULT now(),
	updated_at TIMESTAMPTZ DEFAULT now(),
	is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_client_locations_client_id ON public.client_locations(client_id);

-- updated_at trigger
CREATE TRIGGER set_client_locations_updated_at
	BEFORE UPDATE ON public.client_locations
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add location_id to appointments (nullable for migration safety)
ALTER TABLE public.appointments
	ADD COLUMN location_id UUID REFERENCES public.client_locations(id) ON DELETE SET NULL;

-- Add location_id to recurrence_series (nullable for migration safety)
ALTER TABLE public.recurrence_series
	ADD COLUMN location_id UUID REFERENCES public.client_locations(id) ON DELETE SET NULL;

-- Migrate existing clients.address data into client_locations
INSERT INTO public.client_locations (client_id, label, address, is_active)
SELECT id, 'Primary Location', address, is_active
FROM public.clients
WHERE address IS NOT NULL AND address <> '';

-- Mark clients.address as deprecated
COMMENT ON COLUMN public.clients.address IS 'DEPRECATED: Use client_locations table. Will be removed in a future migration.';

-- Enable RLS
ALTER TABLE public.client_locations ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on client_locations"
	ON public.client_locations
	FOR ALL
	TO authenticated
	USING ((select public.get_user_role()) = 'admin')
	WITH CHECK ((select public.get_user_role()) = 'admin');

-- Employees can SELECT locations for appointments they are assigned to
CREATE POLICY "Employee select locations for assigned appointments"
	ON public.client_locations
	FOR SELECT
	TO authenticated
	USING (
		id IN (
			SELECT a.location_id
			FROM public.appointments a
			WHERE a.location_id IS NOT NULL
			  AND a.id IN (SELECT public.get_employee_appointment_ids())
		)
	);
