-- A cancellation remembers the status it replaced.
--
-- An appointment's status is the only record that the work happened, and today a cancellation
-- destroys it. cancelAppointment (src/lib/actions/appointments.ts:895-920) applies
-- update({ status: 'cancelled' }) with no status filter of any kind, so it overwrites 'completed'
-- as readily as 'scheduled'; uncancelAppointment (:922-948) then writes the literal 'scheduled'
-- back. complete -> cancel -> reopen therefore erases the completion with nothing on screen saying
-- so, and in_progress -> cancel -> reopen silently downgrades a distinction the admin made
-- deliberately. Nothing else in the row can be read as a substitute: completion is an explicit
-- admin status write, an appointment can be completed with no crew assigned at all, and
-- employee_clock has no status predicate, so clock times are not a proxy. Deriving the prior status
-- would be guessing, and guessing wrong reproduces the same silent loss one layer deeper. This
-- column persists it instead. GitHub issue #15; REQ-025.
--
-- FROZEN CONTRACT -- three separate pieces of code key on this column and they must agree.
--
--   * "status_before_cancel" holds the status the row had immediately before it became
--     'cancelled', and nothing else. It is never a preference, never a target, never a default.
--   * It is non-NULL only while "status" = 'cancelled'. Enforced by CHECK, not by convention.
--   * NULL while cancelled is legal and means "not recorded" -- every row cancelled before this
--     migration, and any row an operator cancels by hand in SQL. Consumers restore such a row to
--     'scheduled', which is exactly today's behaviour.
--   * The domain is 'scheduled' | 'in_progress' | 'completed'. 'cancelled' is NOT in it: a
--     cancellation cannot have replaced a cancellation.
--   * 'completed' is in the domain and is currently unreachable through the application (REQ-024
--     refuses that cancellation). The schema deliberately does not encode that application policy.
--   * Every writer sets "status" and "status_before_cancel" in the same UPDATE statement. There is
--     no code path anywhere that writes one without the other. The coherence CHECK makes any
--     attempt fail loudly instead of leaving a lie in the table.
--
-- WHY 'completed' IS IN THE DOMAIN CHECK THOUGH REQ-024 MAKES IT UNREACHABLE. REQ-024 hard-refuses
-- cancelling a completed appointment, so the application will not write 'completed' here. That is
-- an application policy a later product decision may reverse, and the schema is not the place to
-- encode it: if cancelling a completed appointment is ever allowed, the code changes and the
-- schema does not. The gap between the CHECK and REQ-024 is deliberate, not an oversight.
--
-- BACKFILL: none. No row is inserted, updated or deleted by this migration, and no column is
-- dropped, renamed or retyped. Existing rows -- INCLUDING rows already at "status" = 'cancelled' --
-- keep NULL, and NULL means "not recorded", which consumers restore to 'scheduled': byte-for-byte
-- today's behaviour. No stored value changes meaning and no amount anywhere is touched, so
-- constitution §7 is satisfied with no exception required and none is claimed.
--
-- CONSTITUTION §4. This is ADDITIVE. One nullable column and two CHECK constraints; no column is
-- dropped, renamed or retyped and no row is rewritten. Neither CHECK can fail on existing data:
-- every existing row has "status_before_cancel" IS NULL the instant the column is added, and IS
-- NULL satisfies both constraints unconditionally -- the domain CHECK by its first disjunct, the
-- coherence CHECK by its first disjunct, neither of which reads any other column. NO ARCH-1-STYLE
-- HUMAN-APPROVED EXCEPTION IS REQUIRED AND NONE IS CLAIMED. The approving requirement is REQ-025.
--
-- "appointments_employee_view" (20260918130000_restrict_employee_price_visibility.sql:107-120)
-- lists its columns explicitly, so this column is invisible to employees without any change to the
-- view, and this migration makes none (constitution §10).
--
-- DOWN (executed 2026-09-22 against a freshly reset local database). Reverses the schema exactly.
--
--   ALTER TABLE "public"."appointments"
--       DROP CONSTRAINT "appointments_status_before_cancel_only_when_cancelled";
--
--   ALTER TABLE "public"."appointments"
--       DROP CONSTRAINT "appointments_status_before_cancel_check";
--
--   ALTER TABLE "public"."appointments" DROP COLUMN "status_before_cancel";
--
-- The constraints are dropped first so the column drop cannot trip over them, even though DROP
-- COLUMN would cascade to them anyway; being explicit is the precedent in 20260921130000. No part
-- of this down path can fail on data. It discards every recorded prior status, which is the correct
-- behaviour for reverting an additive column and is not a constitution §7 violation: it returns the
-- table to the exact shape and content it had before the UP ran, and the only values lost are ones
-- the UP made it possible to record in the first place.


ALTER TABLE "public"."appointments"
    ADD COLUMN "status_before_cancel" "text";


-- Two constraints, not one. They fail for different reasons -- an illegal value versus an
-- incoherent row -- and a combined CHECK would report the wrong one. The quoting and the
-- = ANY (ARRAY[...]) shape mirror "appointments_status_check"
-- (20260427000000_schema_snapshot.sql:175).
ALTER TABLE "public"."appointments"
    ADD CONSTRAINT "appointments_status_before_cancel_check"
    CHECK (("status_before_cancel" IS NULL) OR ("status_before_cancel" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text"])));


ALTER TABLE "public"."appointments"
    ADD CONSTRAINT "appointments_status_before_cancel_only_when_cancelled"
    CHECK (("status_before_cancel" IS NULL) OR ("status" = 'cancelled'::"text"));


COMMENT ON COLUMN "public"."appointments"."status_before_cancel" IS 'The status this row held immediately before it became cancelled -- never a preference, never a target, never a default. Non-NULL only while status = ''cancelled'', which appointments_status_before_cancel_only_when_cancelled enforces; the domain is ''scheduled'' | ''in_progress'' | ''completed'' and excludes ''cancelled'', because a cancellation cannot have replaced a cancellation. NULL while cancelled is legal and means "not recorded" -- every row cancelled before this column existed, and any row cancelled by hand in SQL -- and consumers restore such a row to ''scheduled''. cancelAppointment and updateAppointment set it in the same UPDATE that writes status; uncancelAppointment clears it in the same UPDATE that restores status. Nothing else writes it.';
