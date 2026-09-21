# 03-SUMMARY — Client-job pricing admin surface

Closed 2026-09-21 by the orchestrator. Code complete, **statically verified only** — the plan's
CRUD browser smoke script has not been run (the user asked for manual test instructions instead).

## What shipped

**`03-01-T1` — server actions** (`coder-sr`) — `src/lib/actions/client-job-pricing.ts`, new.
- Exports: `ClientJobPricingFieldErrors` (`:10`), `ClientJobPricingActionResult` (`:16`),
  `createClientJobPricing` (`:27,31,36`), `updateClientJobPricing` (`:92,96,101`),
  `archiveClientJobPricing` (`:162`), `restoreClientJobPricing` (`:168`). Create and update each
  carry the two-overload `FormData` / `useActionState` shape used across `src/lib/actions/`.
- Follows the house pattern exactly: `requireAdminRole()` → hand-rolled parse → `createAdminClient()`
  → four `revalidatePath` calls → `redirect` on create/update only, called outside the `try` so the
  redirect throw is not swallowed.
- Rate parsing goes through `parseDollarsToCents` only; `0` is accepted, negative/empty/non-numeric
  rejected. Duplicate `(client, job, effective_from)` maps to a field error on the date.

**`03-01-T2` — form and list components** (`designer`)
- `src/components/admin/client-job-pricing-form.tsx`, new — job select showing each job's standard
  rate, `Rate ($/hour)`, `effective_from` defaulting to today, notes; per-field errors with
  `aria-invalid`/`aria-describedby` and a `role="alert"` banner.
- `src/components/admin/client-job-pricing-list.tsx`, new — rules grouped per job, each labelled
  Current / Scheduled / Superseded / Archived, with archived rules behind a `<details>` toggle.

**`03-01-T3` — routes and entry point** (`coder-jr`)
- `(admin)/clients/[id]/pricing/page.tsx`, `.../pricing/new/page.tsx`,
  `.../pricing/[pricingId]/edit/page.tsx`, all new. The edit route scopes its lookup by
  `.eq('id', pricingId).eq('client_id', id)`, so a mismatched pair 404s rather than leaking.
- `(admin)/clients/[id]/page.tsx:115-127` — `Custom Pricing` link added beside `Edit Client`, both
  wrapped in a `flex flex-wrap gap-2` so the header still lays out.

**Fix track after `/code-review high`** (`coder-jr`)
- `client-job-pricing-list.tsx:~194` — grouping and classification moved from `job_name` to
  `job_id`. Nothing enforces unique job names, and grouping by name collapsed two distinct jobs
  into one group, then mislabelled one job's genuinely active rate as "Superseded" while the
  resolver — which keys off `job_id` — went on applying it. `ClientJobPricingRow` already carried
  `job_id`, so no route change was needed.
- `client-job-pricing-list.tsx:~104-120,~140-148` — archive/restore results are no longer
  discarded. Both actions return `{success:false, error}` rather than throwing, so a failed click
  previously produced no state change and no message; a red `role="alert"` banner now renders.

## Requirements closed

REQ-015. Phase 3 does not fall under REQ-021 (the routes are new), so its proof is the CRUD smoke
script — **not run**.

## Deviations from plan

1. The edit route also 404s for an archived rule, which the plan did not specify. It matches
   `updateClientJobPricing`, which only updates non-archived rows, and the sibling location route.
2. The form prefills with `(cents / 100).toFixed(2)`, a dollars↔cents conversion outside
   `money.ts` — a live constitution §2 violation. The plan itself specifies it, and `money.ts`
   exports nothing that yields a bare numeric string valid for `<input type="number">`. **Needs a
   `centsToDollarInput` export in `money.ts` and a follow-up task.**
3. Components are light-only, matching the rest of `src/components/admin/`, which has no dark-mode
   variants anywhere.

## Latent defect found, not fixed — needs its own issue

`client_job_pricing_client_id_job_id_effective_from_key` **ignores `is_archived`**. Archive a wrong
rule, then try to add a correct rule for the same client + job + date: the admin gets
"A rate for this job already starts on that date." while the list shows no such active rule, and
the only escape in the current UI is to restore the archived row and edit it. The fix is a partial
unique index (`WHERE is_archived = false`), i.e. a migration — out of scope for this phase.
