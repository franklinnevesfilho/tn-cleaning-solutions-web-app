


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_employee_appointment_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT appointment_id
    FROM public.appointment_employees
    WHERE employee_id = (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."get_employee_appointment_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
	SELECT id
	FROM public.employees
	WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_employee_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email"("user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;


ALTER FUNCTION "public"."get_user_email"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
	SELECT COALESCE(
		auth.jwt() -> 'app_metadata' ->> 'role',
		'employee'
	)::TEXT;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointment_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "clocked_in_at" timestamp with time zone,
    "clocked_out_at" timestamp with time zone,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false
);


ALTER TABLE "public"."appointment_employees" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."appointment_employees_employee_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "appointment_id",
    "employee_id",
    "clocked_in_at",
    "clocked_out_at",
    "created_at",
    "updated_at",
    "is_archived"
   FROM "public"."appointment_employees";


ALTER VIEW "public"."appointment_employees_employee_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."appointment_employees_employee_view" IS 'Employee-safe view of appointment_employees. Excludes admin_notes column.';



CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "recurrence_series_id" "uuid",
    "scheduled_date" "date" NOT NULL,
    "scheduled_start_time" time without time zone NOT NULL,
    "scheduled_end_time" time without time zone NOT NULL,
    "price_override_cents" integer,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    "location_id" "uuid",
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "label" "text" DEFAULT 'Location'::"text" NOT NULL,
    "address" "text" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."client_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."address" IS 'DEPRECATED: Use client_locations table. Will be removed in a future migration.';



CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_appointments" (
    "invoice_id" "uuid" NOT NULL,
    "appointment_id" "uuid" NOT NULL
);


ALTER TABLE "public"."invoice_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "issued_date" "date",
    "due_date" "date",
    "total_cents" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'paid'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."invoices_with_status" WITH ("security_invoker"='true') AS
 SELECT "id",
    "client_id",
    "status",
    "issued_date",
    "due_date",
    "total_cents",
    "notes",
    "created_at",
    "updated_at",
    "is_archived",
        CASE
            WHEN (("status" = 'issued'::"text") AND ("due_date" < CURRENT_DATE)) THEN 'overdue'::"text"
            ELSE "status"
        END AS "effective_status"
   FROM "public"."invoices" "i";


ALTER VIEW "public"."invoices_with_status" OWNER TO "postgres";


COMMENT ON VIEW "public"."invoices_with_status" IS 'Invoices with computed effective_status field. Overdue is derived from due_date < today when status = issued.';



CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "base_price_cents" integer NOT NULL,
    "estimated_duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurrence_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "frequency" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "max_occurrences" integer,
    "client_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    "location_id" "uuid",
    CONSTRAINT "recurrence_series_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'biweekly'::"text", 'monthly'::"text"])))
);


ALTER TABLE "public"."recurrence_series" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointment_employees"
    ADD CONSTRAINT "appointment_employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_locations"
    ADD CONSTRAINT "client_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."invoice_appointments"
    ADD CONSTRAINT "invoice_appointments_appointment_id_key" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."invoice_appointments"
    ADD CONSTRAINT "invoice_appointments_pkey" PRIMARY KEY ("invoice_id", "appointment_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurrence_series"
    ADD CONSTRAINT "recurrence_series_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointment_employees_appointment_id" ON "public"."appointment_employees" USING "btree" ("appointment_id");



CREATE INDEX "idx_appointment_employees_employee_id" ON "public"."appointment_employees" USING "btree" ("employee_id");



CREATE INDEX "idx_appointments_client_id" ON "public"."appointments" USING "btree" ("client_id");



CREATE INDEX "idx_appointments_job_id" ON "public"."appointments" USING "btree" ("job_id");



CREATE INDEX "idx_appointments_recurrence_series_id" ON "public"."appointments" USING "btree" ("recurrence_series_id");



CREATE INDEX "idx_appointments_scheduled_date" ON "public"."appointments" USING "btree" ("scheduled_date");



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_client_locations_client_id" ON "public"."client_locations" USING "btree" ("client_id");



CREATE INDEX "idx_invoice_appointments_invoice_id" ON "public"."invoice_appointments" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoices_client_id" ON "public"."invoices" USING "btree" ("client_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_recurrence_series_client_id" ON "public"."recurrence_series" USING "btree" ("client_id");



CREATE INDEX "idx_recurrence_series_job_id" ON "public"."recurrence_series" USING "btree" ("job_id");



CREATE OR REPLACE TRIGGER "set_client_locations_updated_at" BEFORE UPDATE ON "public"."client_locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."appointment_employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."invoice_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."recurrence_series" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."appointment_employees"
    ADD CONSTRAINT "appointment_employees_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_employees"
    ADD CONSTRAINT "appointment_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."client_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_recurrence_series_id_fkey" FOREIGN KEY ("recurrence_series_id") REFERENCES "public"."recurrence_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_locations"
    ADD CONSTRAINT "client_locations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_appointments"
    ADD CONSTRAINT "invoice_appointments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_appointments"
    ADD CONSTRAINT "invoice_appointments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurrence_series"
    ADD CONSTRAINT "recurrence_series_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurrence_series"
    ADD CONSTRAINT "recurrence_series_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurrence_series"
    ADD CONSTRAINT "recurrence_series_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."client_locations"("id") ON DELETE SET NULL;



CREATE POLICY "Admin full access on appointment_employees" ON "public"."appointment_employees" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on appointments" ON "public"."appointments" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on client_locations" ON "public"."client_locations" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on clients" ON "public"."clients" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on employees" ON "public"."employees" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on invoice_appointments" ON "public"."invoice_appointments" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on invoices" ON "public"."invoices" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on jobs" ON "public"."jobs" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Admin full access on recurrence_series" ON "public"."recurrence_series" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));



CREATE POLICY "Employee select active employees" ON "public"."employees" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR (("is_active" = true) AND (NOT "is_archived"))));



CREATE POLICY "Employee select assigned appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids"))));



CREATE POLICY "Employee select clients" ON "public"."clients" FOR SELECT TO "authenticated" USING ((NOT "is_archived"));



CREATE POLICY "Employee select jobs" ON "public"."jobs" FOR SELECT TO "authenticated" USING ((NOT "is_archived"));



CREATE POLICY "Employee select locations for assigned appointments" ON "public"."client_locations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "a"."location_id"
   FROM "public"."appointments" "a"
  WHERE (("a"."location_id" IS NOT NULL) AND ("a"."id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids"))))));



CREATE POLICY "Employee select team assignments" ON "public"."appointment_employees" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("appointment_id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids"))));



CREATE POLICY "Employee update own clock times" ON "public"."appointment_employees" FOR UPDATE TO "authenticated" USING (("employee_id" = ( SELECT "public"."get_employee_id"() AS "get_employee_id"))) WITH CHECK (("employee_id" = ( SELECT "public"."get_employee_id"() AS "get_employee_id")));



ALTER TABLE "public"."appointment_employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurrence_series" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."get_employee_appointment_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_appointment_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_appointment_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_email"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_email"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_email"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "postgres";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."appointment_employees" TO "anon";
GRANT ALL ON TABLE "public"."appointment_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_employees" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_employees_employee_view" TO "anon";
GRANT ALL ON TABLE "public"."appointment_employees_employee_view" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_employees_employee_view" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."client_locations" TO "anon";
GRANT ALL ON TABLE "public"."client_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_locations" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_appointments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."invoices_with_status" TO "anon";
GRANT ALL ON TABLE "public"."invoices_with_status" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices_with_status" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."recurrence_series" TO "anon";
GRANT ALL ON TABLE "public"."recurrence_series" TO "authenticated";
GRANT ALL ON TABLE "public"."recurrence_series" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































