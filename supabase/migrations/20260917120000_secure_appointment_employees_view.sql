-- admin_notes is admin-only. RLS cannot mask columns, so an employee with any SELECT
-- policy on the base table can read admin_notes off it directly, whatever the
-- employee-facing view selects. The base table therefore stops being readable by
-- employees at all and every employee read goes through
-- "appointment_employees_employee_view". Re-adding an employee SELECT policy here
-- re-exposes admin_notes to every assigned employee.
DROP POLICY IF EXISTS "Employee select team assignments" ON "public"."appointment_employees";


-- Clock times are now written through "public"."employee_clock", which owns the
-- assignment check. Leaving this policy in place would let an employee run an
-- unfiltered UPDATE (one that reads no column, so no SELECT policy is required) and
-- stamp every one of their assignments at once.
DROP POLICY IF EXISTS "Employee update own clock times" ON "public"."appointment_employees";


-- security_invoker is off on purpose: the caller has no SELECT policy on the base table,
-- so an invoker-rights view would return nothing. The row filter the dropped
-- "Employee select team assignments" policy used to apply therefore has to live in the
-- view body — without it, definer rights would turn the column leak into a full-table leak.
CREATE OR REPLACE VIEW "public"."appointment_employees_employee_view" WITH ("security_invoker"='false') AS
 SELECT "id",
    "appointment_id",
    "employee_id",
    "clocked_in_at",
    "clocked_out_at",
    "created_at",
    "updated_at",
    "is_archived"
   FROM "public"."appointment_employees"
  WHERE ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("appointment_id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids")));


ALTER VIEW "public"."appointment_employees_employee_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."appointment_employees_employee_view" IS 'Employee-safe view of appointment_employees. Excludes the admin_notes column. Runs with definer rights and filters to the caller''s assigned appointments itself.';


-- A definer view with write privileges is an RLS bypass: it is auto-updatable, and the
-- write would run as the view owner against the base table. The blanket GRANT ALL that
-- "public" default privileges hand out therefore has to come back off both employee views
-- so that only SELECT is left. employees_employee_view is included because it became
-- definer-owned in 20260911170000 while keeping GRANT ALL, which let any employee rename,
-- deactivate or archive any other employee straight through the view.
REVOKE ALL ON TABLE "public"."appointment_employees_employee_view" FROM "anon";

REVOKE ALL ON TABLE "public"."appointment_employees_employee_view" FROM "authenticated";

REVOKE ALL ON TABLE "public"."appointment_employees_employee_view" FROM "service_role";

GRANT SELECT ON TABLE "public"."appointment_employees_employee_view" TO "authenticated";

GRANT SELECT ON TABLE "public"."appointment_employees_employee_view" TO "service_role";


REVOKE ALL ON TABLE "public"."employees_employee_view" FROM "anon";

REVOKE ALL ON TABLE "public"."employees_employee_view" FROM "authenticated";

REVOKE ALL ON TABLE "public"."employees_employee_view" FROM "service_role";

GRANT SELECT ON TABLE "public"."employees_employee_view" TO "authenticated";

GRANT SELECT ON TABLE "public"."employees_employee_view" TO "service_role";


-- Definer rights are what let an employee write a clock time without any policy on the
-- base table. The assignment check below is the whole authorization story: it must stay
-- keyed off get_employee_id() rather than a caller-supplied employee id, and the state
-- guards must stay inside this statement so two concurrent calls cannot both pass them.
CREATE OR REPLACE FUNCTION "public"."employee_clock"("assignment_id" "uuid", "clock_action" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
	clocked_in timestamp with time zone;
	clocked_out timestamp with time zone;
	outcome text;
BEGIN
	IF clock_action NOT IN ('in', 'out') THEN
		RAISE EXCEPTION 'unknown clock action: %', clock_action;
	END IF;

	SELECT appointment_employees.clocked_in_at, appointment_employees.clocked_out_at
	INTO clocked_in, clocked_out
	FROM public.appointment_employees
	WHERE appointment_employees.id = assignment_id
		AND appointment_employees.employee_id = public.get_employee_id()
	FOR UPDATE;

	IF NOT FOUND THEN
		outcome := 'not_assigned';
	ELSIF clock_action = 'in' AND clocked_out IS NOT NULL THEN
		outcome := 'clock_in_after_clock_out';
	ELSIF clock_action = 'in' AND clocked_in IS NOT NULL THEN
		outcome := 'already_clocked_in';
	ELSIF clock_action = 'out' AND clocked_out IS NOT NULL THEN
		outcome := 'already_clocked_out';
	ELSIF clock_action = 'out' AND clocked_in IS NULL THEN
		outcome := 'clock_out_before_clock_in';
	ELSE
		UPDATE public.appointment_employees
		SET clocked_in_at = CASE WHEN clock_action = 'in' THEN now() ELSE clocked_in_at END,
			clocked_out_at = CASE WHEN clock_action = 'out' THEN now() ELSE clocked_out_at END
		WHERE appointment_employees.id = assignment_id;

		outcome := 'clocked';
	END IF;

	RETURN outcome;
END;
$$;


ALTER FUNCTION "public"."employee_clock"("assignment_id" "uuid", "clock_action" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."employee_clock"("assignment_id" "uuid", "clock_action" "text") IS 'Stamps clocked_in_at or clocked_out_at on one of the calling employee''s own assignments. Runs with definer rights because employees have no policy on appointment_employees.';


-- anon keeps EXECUTE, like every other function in this schema. The grant is safe because
-- the function resolves the employee from auth.uid() instead of an argument, so a caller
-- without a session matches no assignment and writes nothing. Do not try to revoke it:
-- CREATE FUNCTION also grants EXECUTE to PUBLIC, so revoking from anon alone is a no-op,
-- and revoking from PUBLIC makes the denied-EXECUTE path crash the backend with SIGSEGV on
-- the Supabase Postgres 17.6 image. That crash is a property of the image, not of this
-- function -- it reproduces on any plpgsql SECURITY DEFINER function called through
-- PostgREST rpc -- so there is nothing to fix here, and a revoke would hand any
-- unauthenticated caller a database restart.
GRANT ALL ON FUNCTION "public"."employee_clock"("assignment_id" "uuid", "clock_action" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."employee_clock"("assignment_id" "uuid", "clock_action" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."employee_clock"("assignment_id" "uuid", "clock_action" "text") TO "service_role";
