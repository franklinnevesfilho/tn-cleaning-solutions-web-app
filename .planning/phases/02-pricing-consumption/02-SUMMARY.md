# 02-SUMMARY — Pricing consumption

Closed 2026-09-21 by the orchestrator. Code complete, **statically verified only** — the REQ-021
browser walk has not been run (the user asked for manual test instructions instead of test runs).

## What shipped

**`02-01-T1` — jobs action, list, routes** (`coder-jr`)
- `src/lib/actions/jobs.ts:6,12,23,~54,~63` — `hourly_rate_cents` replaces `base_price_cents`
  throughout; the inline `Number()`/`Math.round` parser is gone in favour of `parseDollarsToCents`.
- `src/components/admin/jobs-list.tsx:10,16,~78` — local `usdFormatter`/`formatPrice` deleted,
  renders `formatRate(job.hourly_rate_cents)`.
- `(admin)/jobs/page.tsx:15,20` and `(admin)/jobs/[id]/edit/page.tsx:18,49` — selects updated.
- Deviation: the separate "Price cannot be negative." message is gone; empty and negative now share
  the single hourly-rate error, as the plan specifies.

**`02-01-T2` — job form** (`designer`)
- `src/components/admin/job-form.tsx:18,23,~97-127` — one `$/hour` field named `hourly_rate_cents`,
  labelled `Hourly Rate ($/hour)`, helper text stating a 2h30m visit at $45.00/h bills $112.50; the
  duration field gained a helper saying it does not affect price. `aria-describedby` wired for both.

**`02-02-T1` — appointments** (`coder-sr`)
- `src/lib/actions/appointments.ts:6,233-235,344-346` — local `parseMoneyToCents` deleted;
  `:831-833` future recurring occurrences now insert `price_override_cents: null` (REQ-014/DET-2).
- `src/components/admin/appointments-types.ts:14-21` — `job` narrowed to `{id,name}`; added
  `price_display_cents`, `price_is_billed`.
- `(admin)/appointments/page.tsx:18-26,75-80,90-105,115-116` — one batched `fetchClientJobRules`
  per page, then per-row resolution; `billed ?? resolved`, tested with `??`/`!== null` so a genuine
  `0` renders as `$0.00` rather than silently re-deriving.
- `(admin)/appointments/[id]/page.tsx:136-163,259-266,400-423` — replaces `override ?? base ?? 0`
  with billed-or-resolved plus a rate breakdown and a source label. **Branches before resolving**,
  so an invoiced appointment issues no pricing query at all.
- `(admin)/appointments/[id]/edit/page.tsx:69,101-117,183` — resolves the client rule against the
  appointment's own `scheduled_date`, not today.
- `src/components/admin/appointment-form.tsx:19,26-31,117-131,218,280,294` — rate hint and relabelled
  override field.
- `src/components/admin/new-appointment-schedule-context.tsx:16,29,105` — dead `base_price_cents`
  dropped.

**`02-02-T2` — invoices** (`coder-sr`)
- `src/lib/actions/invoices.ts` — `applyAppointmentPricesAndGetTotal` became `buildInvoiceLines`
  (`:161-229`) and **writes nothing**; the `price_override_cents` back-write is deleted. New
  `writeBilledPriceCache`/`clearBilledPriceCache` (`:247-273`), `restoreInvoiceLines` (`:275-287`).
  `createInvoice` `:286-338`, `updateInvoice` `:411-493`.
- Frozen lines: `invoice_appointments.billed_amount_cents/billed_rate_cents/billed_minutes` are
  written on save; `billed_rate_cents`/`billed_minutes` are null when the admin overtypes an amount.
- `src/components/admin/invoice-form.tsx:14,23-25,63,67-82` — `job_base_price_cents` gone, local
  `currencyFromCents` deleted, rate-breakdown hint added.
- `(admin)/invoices/[id]/page.tsx:118-128,138-148,162-172,345-352` — renders stored `billed_*` only;
  nothing on that page recomputes a price.

**Fix tracks after `/code-review high`** (three parallel agents)
- Invoices: cache-write failures are no longer reported as failed saves (they were leaving an
  orphaned invoice and a misleading duplicate error on retry); `updateInvoice` reordered to
  delete → insert → cache → update with `restoreInvoiceLines` compensation, so a lost race no
  longer leaves an invoice with a total and zero lines; `fetchClientJobRules` failures on
  `invoices/new` and `invoices/[id]/edit` now render the existing banner instead of a 500.
- Appointments: the job-picker hint no longer asserts a client-specific rate after the admin
  switches client — it renders `· this client's negotiated rate, if any, applies on save`; the
  same unguarded `fetchClientJobRules` 500 was fixed on `appointments/page.tsx`,
  `[id]/page.tsx` and `[id]/edit/page.tsx`.

**`02-03-T1` — the OQ-R1 revert**
- The cache-clearing block added to `voidInvoice` (formerly `invoices.ts:632-641`) was removed.
  Applied by the orchestrator after the delegated agent was cut off by a rate limit.
  `clearBilledPriceCache` is retained; its one live caller is `updateInvoice:476`.

## Requirements closed

REQ-004 (adoption; grep returns zero), REQ-005 (adoption), REQ-006, REQ-012, REQ-013, REQ-014,
REQ-017 (sweep), REQ-018 (write path, as originally specified). **REQ-021 is NOT closed** — the
browser walk has not been run.

## Deviations from plan

1. **`src/components/admin/appointments-list.tsx` was edited by `02-02-T1` although no task owns
   it.** The plan body mandates the per-row amount (DET-13); its "Files owned" block was not
   updated when DET-13 was added. No write conflict occurred. `ROADMAP.md`'s map needs amending.
2. **`voidInvoice` briefly shipped the opposite of the spec**, was adjudicated (D-23), ratified by
   the user as option (a), and reverted. Net effect on the tree: none. See `02-03-PLAN.md`.
3. `src/types/duration-result.ts` was created outside the owned-file map to fix a pre-existing
   broken import that blocked `npm run build`.
4. `revalidateInvoicePaths` also revalidates `/solutions/appointments`, since invoice mutations now
   change what that list displays. Not requested by the plan.
5. The edit page seeds preselected invoice lines from the frozen junction row rather than
   re-resolving, so re-opening a draft does not silently reset an overtyped line.

## Known limitations carried forward

- No transaction spans the invoice REST calls; a crash mid-save leaves a self-healing cache drift
  that a later draft save repairs and the check script reports.
- `invoices/new` resolves every un-invoiced appointment across all clients, so the batched rules
  lookup builds a large `.in() × .in()` query string. Fails gracefully now, but will not scale.
- `fetchClientJobRules` throws rather than returning an error, which is why the same try/catch now
  appears in five route files. The clean fix is in `src/lib/pricing/lookup.ts`, which is frozen.
