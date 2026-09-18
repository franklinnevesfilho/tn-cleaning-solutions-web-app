import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  pickEffectiveRule,
  resolveAppointmentPrice,
  type ClientJobRule,
} from '../../src/lib/pricing/resolve.ts'

const job = { hourly_rate_cents: 4500 }

function rule(effectiveFrom: string, hourlyRateCents: number, isArchived = false): ClientJobRule {
  return {
    hourly_rate_cents: hourlyRateCents,
    effective_from: effectiveFrom,
    is_archived: isArchived,
  }
}

test('pickEffectiveRule returns null when nothing applies', () => {
  assert.equal(pickEffectiveRule([], '2026-10-01'), null)
  assert.equal(pickEffectiveRule([rule('2026-10-02', 3800)], '2026-10-01'), null)
})

test('pickEffectiveRule takes the newest rule on or before the date', () => {
  const older = rule('2026-01-01', 3000)
  const newer = rule('2026-06-01', 3800)
  const future = rule('2027-01-01', 5000)

  assert.equal(pickEffectiveRule([older, newer], '2026-09-30'), newer)
  assert.equal(pickEffectiveRule([newer, older], '2026-09-30'), newer)
  assert.equal(pickEffectiveRule([older, newer, future], '2026-09-30'), newer)
  assert.equal(pickEffectiveRule([older, newer], '2026-05-31'), older)
})

test('pickEffectiveRule never selects an archived rule', () => {
  const archivedNewest = rule('2026-06-01', 9900, true)
  const live = rule('2026-01-01', 3000)

  assert.equal(pickEffectiveRule([live, archivedNewest], '2026-09-30'), live)
  assert.equal(pickEffectiveRule([archivedNewest], '2026-09-30'), null)
  assert.equal(pickEffectiveRule([archivedNewest], '2027-01-01'), null)
})

test('the effective_from boundary is inclusive', () => {
  const rules = [rule('2026-10-01', 3800)]

  assert.equal(pickEffectiveRule(rules, '2026-09-30'), null)
  assert.equal(pickEffectiveRule(rules, '2026-10-01'), rules[0])
  assert.equal(pickEffectiveRule(rules, '2026-10-02'), rules[0])
})

test('resolveAppointmentPrice falls back to the job rate', () => {
  assert.deepEqual(
    resolveAppointmentPrice({ job, rule: null, minutes: 150, appointmentOverrideCents: null }),
    { amount_cents: 11250, rate_cents: 4500, minutes: 150, source: 'job' }
  )
})

test('resolveAppointmentPrice prefers a client rule over the job rate', () => {
  const rules = [rule('2026-10-01', 3800)]

  assert.deepEqual(
    resolveAppointmentPrice({
      job,
      rule: pickEffectiveRule(rules, '2026-09-30'),
      minutes: 150,
      appointmentOverrideCents: null,
    }),
    { amount_cents: 11250, rate_cents: 4500, minutes: 150, source: 'job' }
  )

  assert.deepEqual(
    resolveAppointmentPrice({
      job,
      rule: pickEffectiveRule(rules, '2026-10-01'),
      minutes: 150,
      appointmentOverrideCents: null,
    }),
    { amount_cents: 9500, rate_cents: 3800, minutes: 150, source: 'client_job_pricing' }
  )
})

test('resolveAppointmentPrice lets a manual override win over both', () => {
  assert.deepEqual(
    resolveAppointmentPrice({
      job,
      rule: rule('2026-01-01', 3800),
      minutes: 150,
      appointmentOverrideCents: 20000,
    }),
    { amount_cents: 20000, rate_cents: null, minutes: null, source: 'appointment_override' }
  )
})

test('a zero override is still an override', () => {
  assert.deepEqual(
    resolveAppointmentPrice({ job, rule: null, minutes: 150, appointmentOverrideCents: 0 }),
    { amount_cents: 0, rate_cents: null, minutes: null, source: 'appointment_override' }
  )
})

test('resolveAppointmentPrice rounds the line once', () => {
  const resolved = resolveAppointmentPrice({
    job: { hourly_rate_cents: 3333 },
    rule: null,
    minutes: 50,
    appointmentOverrideCents: null,
  })

  assert.equal(resolved.amount_cents, 2778)
  assert.equal(resolved.rate_cents, 3333)
  assert.equal(resolved.minutes, 50)
  assert.equal(resolved.source, 'job')
})
