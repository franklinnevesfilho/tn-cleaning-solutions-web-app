ALTER TABLE "public"."employees" ADD COLUMN IF NOT EXISTS "started_at" "date";

ALTER TABLE "public"."employees" ADD COLUMN IF NOT EXISTS "address" "text";

ALTER TABLE "public"."employees" ADD COLUMN IF NOT EXISTS "e_transfer_email" "text";


-- address and e_transfer_email are admin-only. RLS cannot mask columns, so the base
-- table stops returning other employees' rows entirely and teammate lookups go through
-- "employees_employee_view", which never selects those two columns. Widening this policy
-- back to all active employees re-exposes both columns to every authenticated user.
DROP POLICY IF EXISTS "Employee select active employees" ON "public"."employees";

DROP POLICY IF EXISTS "Employee select own employee row" ON "public"."employees";

CREATE POLICY "Employee select own employee row" ON "public"."employees" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));


-- security_invoker is off on purpose: the caller's RLS now stops at their own row, so an
-- invoker-rights view would return nothing. The active/non-archived filter that the base
-- policy used to apply therefore has to live in the view body.
CREATE OR REPLACE VIEW "public"."employees_employee_view" WITH ("security_invoker"='false') AS
 SELECT "id",
    "user_id",
    "full_name",
    "phone",
    "started_at",
    "is_active",
    "created_at",
    "updated_at",
    "is_archived"
   FROM "public"."employees"
  WHERE (("is_active" = true) AND (NOT "is_archived"));


ALTER VIEW "public"."employees_employee_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."employees_employee_view" IS 'Employee-safe view of employees. Excludes address and e_transfer_email columns. Runs with definer rights and filters to active, non-archived employees itself.';


REVOKE ALL ON TABLE "public"."employees_employee_view" FROM "anon";

GRANT SELECT ON TABLE "public"."employees_employee_view" TO "authenticated";

GRANT SELECT ON TABLE "public"."employees_employee_view" TO "service_role";
