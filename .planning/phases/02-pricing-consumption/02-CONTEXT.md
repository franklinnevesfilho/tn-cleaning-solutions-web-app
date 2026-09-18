# 02-CONTEXT — Pricing consumption

Revised 2026-09-18. Every reference to a pricing *mode* is gone: under ARCH-1 (D-09) a job has one
hourly rate and nothing else, and under D-16 a client rule does too.

## Goal

Every place that reads a price switches to `src/lib/pricing/`. The invoice builder stops
back-writing appointment overrides and starts freezing lines. The rename's type ripple is cleared
and the tree builds again. After this phase the feature is usable by an admin except for managing
client rules, which Phase 3 adds.

## The rule, stated once

```
DISPLAYED price of an appointment, anywhere in the admin UI
  = appointments.billed_price_cents   if NOT NULL   -> label "Invoiced", never recomputed
  = resolveAppointmentPrice(...)      otherwise     -> label by resolved.source
```
`resolveAppointmentPrice` precedence is **override → client rule → job rate**, all hourly except
the override. Full statement in `../01-pricing-foundation/01-CONTEXT.md` "The two prices".

## Prerequisite artifacts (from Phase 1)

- `jobs.hourly_rate_cents` (integer NOT NULL — **renamed from `base_price_cents`**, which no longer
  exists), `appointments.billed_price_cents` (nullable),
  `invoice_appointments.billed_amount_cents / billed_rate_cents / billed_minutes`, table
  `client_job_pricing` (hourly-rate-only).
- `src/types/database.ts` reflecting all of the above.
- `src/lib/pricing/money.ts` — `parseDollarsToCents`, `formatCents`, `formatRate(cents)`,
  `durationMinutes`, `hourlyAmountCents`.
- `src/lib/pricing/resolve.ts` — `resolveAppointmentPrice`, `pickEffectiveRule`, and the
  `JobPricing` / `ClientJobRule` / `ResolvedPrice` types. **`ResolvedPrice` has no `pricing_mode`
  field**; `rate_cents` and `minutes` are null only for a manual override.
- `src/lib/pricing/lookup.ts` — `fetchClientJobRules(client, pairs)`.

Exact signatures are in `../01-pricing-foundation/01-02-PLAN.md`. Write against them.

## You are inheriting a red tree — that is expected

Phase 1 renames the column ahead of its call sites (D-19 / REQ-017), so `npx tsc --noEmit` and
`npm run build` fail when you start. The failures in **your** owned files are your work list. A
failure in a file you do not own belongs to a sibling task — do not reach into it. Clearing the
whole list is the Phase 2 gate, and it needs all four tasks.

## Plans in this phase

| Plan | Scope | Runs concurrently with |
|---|---|---|
| `02-01-PLAN.md` | jobs action + jobs pages + jobs list; jobs form | `02-02`, all of Phase 3 |
| `02-02-PLAN.md` | appointments; invoices | `02-01`, all of Phase 3 |

The full owned-file map, and its collision check, live in `ROADMAP.md`. No writable file appears in
more than one task.

## The complete list of sites that must change

Re-verified against the working tree at `7ae55f5`. **Line numbers were accurate then but the files
are live — grep for the expression, do not trust the number.**

| Site | Today | After |
|---|---|---|
| `src/lib/actions/jobs.ts:11,22,53,62-93,100` | flat price + duration, inline parser | one `hourly_rate_cents`, parsed via `parseDollarsToCents` |
| `src/components/admin/job-form.tsx:96-155` | one `$` field labelled Price | one `$/hour` field; duration helper says it does not price the job |
| `src/components/admin/jobs-list.tsx:15,20-27,84` | `formatPrice(base_price_cents)` | `formatRate(hourly_rate_cents)` from `money.ts` |
| `(admin)/jobs/page.tsx:15,20`, `(admin)/jobs/[id]/edit/page.tsx:18,49` | select `base_price_cents` | select `hourly_rate_cents` |
| `src/lib/actions/appointments.ts:82-93` | local `parseMoneyToCents` | delete; use `money.ts` |
| `src/lib/actions/appointments.ts:847` | copies `price_override_cents` forward | `null` (REQ-014 / DET-2) |
| `src/components/admin/appointment-form.tsx:25,197` | client-side `base_price_cents/100` | server-resolved default passed as a prop (DET-10) |
| `(admin)/appointments/[id]/page.tsx:33,107,125,223` | `override ?? base ?? 0` | billed-or-resolved + breakdown + source label |
| `(admin)/appointments/page.tsx:20,73,91,99` | carries `base_price_cents`, renders **no** price | renders a per-row amount (DET-13) |
| `new-appointment-schedule-context.tsx:16,29,103` | fetches `base_price_cents`, renders nothing | drop the field (dead data — `01-RESEARCH.md §4`) |
| `appointments-types.ts:16` | `job.base_price_cents` | drop the field |
| `src/lib/actions/invoices.ts:27-34,66-77,133-152,154-200,256,370` | `jobs!inner(base_price_cents)`, back-writes overrides | resolver + frozen `billed_*` lines + `billed_price_cents` write |
| `src/components/admin/invoice-form.tsx:22,60-65,296,320` | `job_base_price_cents` | resolved amount + rate breakdown |
| `(admin)/invoices/new/page.tsx:18,35,65`, `(admin)/invoices/[id]/edit/page.tsx:19,32,69,102` | fetch base price | fetch the rate + times, resolve server-side |
| `(admin)/invoices/[id]/page.tsx:47,128,146` | recomputes the effective price | reads the frozen `billed_*` |

## Deliberately not in scope

- `(admin)/dashboard/page.tsx` and `(admin)/invoices/page.tsx` — they read `invoices.total_cents`,
  whose meaning does not change. Their local `Intl.NumberFormat` instances stay (DET-12).
- The three employee screens — **Phase 1's 01-03-T2 owns them** (ARCH-5 = (b)) and may still be
  editing them while you work, since it runs in the same block as you. Do not touch
  them. If you believe one needs a price, stop and report; it does not.
- `jobs.estimated_duration_minutes` — stays an advisory estimate, never used for money (D-18).
- Any commit, any deploy, any migration. If you find you need a column that does not exist,
  **stop and report** rather than adding a migration.

## Behaviour changes a reviewer must be told about

1. **Every job's effective price changed.** A job that charged a flat $150 per visit now charges
   $150 per hour (D-09). This is the owner's deliberate decision, not a bug, and the blast radius
   was reported by Phase 1's `pricing_backfill_check.sql`.
2. Editing a line price in the invoice builder no longer writes back to
   `appointments.price_override_cents` (DET-9). It writes `appointments.billed_price_cents`
   instead — a display cache, never a pricing input.
3. Removing an appointment from a draft invoice reverts it to the live derived price.
4. Regenerating future occurrences of a recurring appointment no longer copies the source
   occurrence's manual override forward (DET-2 / REQ-014).
5. The appointments **list** now shows a per-row amount where it previously showed none (DET-13).
