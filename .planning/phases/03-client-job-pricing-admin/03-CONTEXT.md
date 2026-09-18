# 03-CONTEXT — Client-job pricing admin surface

## Goal

Give an admin CRUD over `client_job_pricing` so loyalty rates can actually be entered. Without
this phase the table exists and is consumed but can only be populated by SQL.

## Dependency reality

This phase depends on **Phase 1 only** — the `client_job_pricing` table, its `database.ts` entry,
and `money.ts`. It does **not** depend on Phase 2 and shares no writable file with it. Dispatch it
in the same block as Phase 2.

## The pattern to copy

The client-locations CRUD is the template, and it is a close match (a child collection hung off a
client, with archive/restore rather than delete):

- Actions: `addLocation` / `updateLocation` / `archiveLocation` / `restoreLocation` in
  `src/lib/actions/clients.ts:297-540`. Note the shape — a local `requireAdminRole()`, a
  hand-rolled `parseLocationFormData`, a `createAdminClient()` write, then
  `revalidatePath('/solutions/clients')` + `revalidatePath('/solutions/clients/${clientId}')`.
- Component: `src/components/admin/location-form.tsx`.
- Routes: `clients/[id]/locations/new/page.tsx` and
  `clients/[id]/locations/[locationId]/edit/page.tsx` — each a server component that verifies the
  client exists and is not archived (`notFound()` otherwise), renders a back-link chip and an
  `h1`, then the form.
- List rendering: the `LocationCard` inline component inside
  `clients/[id]/page.tsx:23-80`, including its inline `'use server'` archive/restore handler.

Follow all of it. Do not invent a new shape.

New actions file is `src/lib/actions/client-job-pricing.ts` rather than appending to `clients.ts`
(already 540+ lines) — one file per domain is the established convention
(`CODEBASE-MAP.md §1`).

## Authorization

The `(admin)` route group layout (`src/app/(internal)/solutions/(admin)/layout.tsx`) already
redirects non-admins, and every write goes through `requireAdminRole()` + `createAdminClient()`.
`client_job_pricing` has an admin-only RLS policy and no employee policy (REQ-008), so a server
read through `createClient()` returns nothing for an employee even if they reached the route.
Do not add a second gate.

## Semantics the UI must express

- A rule is `(client, job, effective_from) → hourly rate`. Adding a new rate for the same
  client+job is an **insert with a later `effective_from`**, not an edit. The UI must make that the
  obvious action ("Add Rate") while still permitting editing a row that was entered wrongly.
- The rule that applies to an appointment is the newest non-archived rule whose `effective_from`
  is on or before the appointment's `scheduled_date` (`pickEffectiveRule` in
  `src/lib/pricing/resolve.ts`). The list must mark which row that is **as of today**, so an admin
  can see the live rate at a glance. The boundary is **inclusive**: a rule effective today is
  `Current`, not `Scheduled`.
- **A rule carries exactly one number: `hourly_rate_cents` (D-16).** There is no mode and no flat
  price. A client who has negotiated a fixed quote for one visit is handled by
  `appointments.price_override_cents`, unchanged. If an admin asks for a per-client flat price,
  that is a new requirement, not a bug — see D-16 for the reversal cost.
- Archiving a rule removes it from resolution; restoring puts it back.
- A rule change moves the price of every un-invoiced appointment for that client on that job, from
  `effective_from` forward. Already-invoiced appointments never move (their amount is frozen on
  `invoice_appointments` and cached on `appointments.billed_price_cents`). The actions therefore
  revalidate `/solutions/appointments` as well as the client paths.

## Out of scope for this phase

- No bulk import, no copy-rates-between-clients, no percentage discounts (DET-3).
- No employee-facing view of any of this (REQ-008, constitution §11).
- No `effective_to` field — ARCH-3 = B, ending a rate means inserting the next one.
- No `pricing_mode`, no `flat_price_cents` (D-16, constitution §8).
- No changes to appointments, invoices, jobs, or `src/lib/pricing/` — other tasks own those files.
- No migration. No commit. No deploy.
