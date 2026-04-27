DO $$
DECLARE
	franklin_employee_user_id UUID;
	franklin_employee_id UUID;
	sarah_user_id UUID;
	sarah_employee_id UUID;
	test_client_id UUID;
	test_job_id UUID;
	test_appointment_id UUID;
	test_location_id UUID;
BEGIN
	SELECT id INTO franklin_employee_user_id
	FROM auth.users
	WHERE email = 'franklin.neves.filho+employee@gmail.com'
	LIMIT 1;

	IF franklin_employee_user_id IS NOT NULL THEN
		SELECT id INTO franklin_employee_id
		FROM public.employees
		WHERE user_id = franklin_employee_user_id
		LIMIT 1;
	END IF;

	SELECT id INTO sarah_user_id
	FROM auth.users
	WHERE email = 'sarah.johnson@tncleaningsolutions.com'
	LIMIT 1;

	IF sarah_user_id IS NOT NULL THEN
		SELECT id INTO sarah_employee_id
		FROM public.employees
		WHERE user_id = sarah_user_id
		LIMIT 1;
	END IF;

	INSERT INTO public.clients (
		name,
		email,
		phone,
		address,
		notes,
		is_active
	)
	SELECT
		'Johnson Family',
		'mjohnson@email.com',
		'(615) 555-0200',
		'123 Main St, Nashville, TN 37201',
		'Weekly cleaning, has a friendly golden retriever named Max',
		true
	WHERE NOT EXISTS (
		SELECT 1
		FROM public.clients
		WHERE name = 'Johnson Family'
	)
	RETURNING id INTO test_client_id;

	IF test_client_id IS NULL THEN
		SELECT id INTO test_client_id
		FROM public.clients
		WHERE name = 'Johnson Family'
		LIMIT 1;
	END IF;

	-- Upsert the primary location for Johnson Family
	IF test_client_id IS NOT NULL THEN
		SELECT id INTO test_location_id
		FROM public.client_locations
		WHERE client_id = test_client_id
			AND label = 'Primary Location'
		LIMIT 1;

		IF test_location_id IS NULL THEN
			INSERT INTO public.client_locations (client_id, label, address, is_active)
			VALUES (
				test_client_id,
				'Primary Location',
				'123 Main St, Nashville, TN 37201',
				true
			)
			RETURNING id INTO test_location_id;
		END IF;
	END IF;

	INSERT INTO public.jobs (
		name,
		description,
		base_price_cents,
		estimated_duration_minutes
	)
	SELECT
		'Standard House Cleaning',
		'Complete house cleaning including kitchen, bathrooms, living areas, and bedrooms',
		15000,
		120
	WHERE NOT EXISTS (
		SELECT 1
		FROM public.jobs
		WHERE name = 'Standard House Cleaning'
	)
	RETURNING id INTO test_job_id;

	IF test_job_id IS NULL THEN
		SELECT id INTO test_job_id
		FROM public.jobs
		WHERE name = 'Standard House Cleaning'
		LIMIT 1;
	END IF;

	IF test_client_id IS NOT NULL AND test_job_id IS NOT NULL THEN
		SELECT id INTO test_appointment_id
		FROM public.appointments
		WHERE client_id = test_client_id
			AND job_id = test_job_id
			AND scheduled_date = CURRENT_DATE
			AND scheduled_start_time = TIME '09:00:00'
			AND scheduled_end_time = TIME '11:00:00'
		LIMIT 1;

		IF test_appointment_id IS NULL THEN
			INSERT INTO public.appointments (
				client_id,
				job_id,
				location_id,
				scheduled_date,
				scheduled_start_time,
				scheduled_end_time,
				status,
				notes
			)
			VALUES (
				test_client_id,
				test_job_id,
				test_location_id,
				CURRENT_DATE,
				TIME '09:00:00',
				TIME '11:00:00',
				'scheduled',
				'First visit - client will leave the key under the front door mat. The dog is friendly but energetic.'
			)
			RETURNING id INTO test_appointment_id;
		END IF;

		-- Ensure location_id is set on the existing appointment
		IF test_appointment_id IS NOT NULL AND test_location_id IS NOT NULL THEN
			UPDATE public.appointments
			SET location_id = test_location_id
			WHERE id = test_appointment_id AND location_id IS NULL;
		END IF;

		IF test_appointment_id IS NOT NULL AND franklin_employee_id IS NOT NULL THEN
			INSERT INTO public.appointment_employees (
				appointment_id,
				employee_id
			)
			SELECT test_appointment_id, franklin_employee_id
			WHERE NOT EXISTS (
				SELECT 1
				FROM public.appointment_employees
				WHERE appointment_id = test_appointment_id
					AND employee_id = franklin_employee_id
			);
		END IF;

		IF test_appointment_id IS NOT NULL AND sarah_employee_id IS NOT NULL THEN
			INSERT INTO public.appointment_employees (
				appointment_id,
				employee_id
			)
			SELECT test_appointment_id, sarah_employee_id
			WHERE NOT EXISTS (
				SELECT 1
				FROM public.appointment_employees
				WHERE appointment_id = test_appointment_id
					AND employee_id = sarah_employee_id
			);
		END IF;
	END IF;

	IF franklin_employee_id IS NOT NULL AND sarah_employee_id IS NOT NULL THEN
		RAISE NOTICE 'Test data created successfully!';
		RAISE NOTICE '';
		RAISE NOTICE 'Appointment for TODAY at 9:00 AM - 11:00 AM';
		RAISE NOTICE 'Assigned to:';
		RAISE NOTICE '  - Franklin Neves Filho (franklin.neves.filho+employee@gmail.com)';
		RAISE NOTICE '  - Sarah Johnson (sarah.johnson@tncleaningsolutions.com)';
		RAISE NOTICE '';
		RAISE NOTICE 'To test:';
		RAISE NOTICE '  1. Login as Franklin employee: franklin.neves.filho+employee@gmail.com / employee123';
		RAISE NOTICE '  2. Go to Schedule page - should see today''s appointment';
		RAISE NOTICE '  3. Open the appointment to view details and clock in/out';
	ELSE
		RAISE WARNING 'Could not find employee accounts. Run seed script first: npm run seed:admin';
	END IF;
END $$;
