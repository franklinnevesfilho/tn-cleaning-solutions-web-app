import { hourlyAmountCents } from './money.ts'

export type JobPricing = {
  hourly_rate_cents: number
}

export type ClientJobRule = {
  hourly_rate_cents: number
  effective_from: string
  is_archived: boolean
}

export type PriceSource = 'appointment_override' | 'client_job_pricing' | 'job'

export type ResolvedPrice = {
  amount_cents: number
  rate_cents: number | null
  minutes: number | null
  source: PriceSource
}

type ResolveAppointmentPriceInput = {
  job: JobPricing
  rule: ClientJobRule | null
  minutes: number
  appointmentOverrideCents: number | null
}

export function pickEffectiveRule<T extends ClientJobRule>(rules: T[], onDate: string): T | null {
  let effective: T | null = null

  for (const rule of rules) {
    if (rule.is_archived || rule.effective_from > onDate) {
      continue
    }

    if (effective === null || rule.effective_from > effective.effective_from) {
      effective = rule
    }
  }

  return effective
}

export function resolveAppointmentPrice({
  job,
  rule,
  minutes,
  appointmentOverrideCents,
}: ResolveAppointmentPriceInput): ResolvedPrice {
  let resolved: ResolvedPrice

  if (appointmentOverrideCents !== null) {
    resolved = {
      amount_cents: appointmentOverrideCents,
      rate_cents: null,
      minutes: null,
      source: 'appointment_override',
    }
  } else {
    const rateCents = (rule ?? job).hourly_rate_cents

    resolved = {
      amount_cents: hourlyAmountCents(rateCents, minutes),
      rate_cents: rateCents,
      minutes,
      source: rule === null ? 'job' : 'client_job_pricing',
    }
  }

  return resolved
}
