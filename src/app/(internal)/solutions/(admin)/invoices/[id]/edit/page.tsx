import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { InvoiceForm, type AppointmentOption } from '@/components/admin/invoice-form'
import { fetchClientJobRules } from '@/lib/pricing/lookup'
import { durationMinutes } from '@/lib/pricing/money'
import { type ClientJobRule, pickEffectiveRule, resolveAppointmentPrice } from '@/lib/pricing/resolve'
import { createClient } from '@/lib/supabase/server'

type EditInvoicePageProps = {
  params: Promise<{ id: string }>
}

type AppointmentRow = {
  id: string
  client_id: string
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  price_override_cents: number | null
  jobs: { id: string; name: string; hourly_rate_cents: number }
  client_locations: { label: string; address: string } | null
  clients: { id: string; name: string } | null
}

type LineAmount = {
  amount_cents: number
  rate_cents: number | null
  minutes: number | null
}

const appointmentSelect = `
  id, client_id, scheduled_date, scheduled_start_time, scheduled_end_time,
  price_override_cents,
  jobs!inner ( id, name, hourly_rate_cents ),
  client_locations ( label, address ),
  clients!inner ( id, name )
`

function toAppointmentOption(row: AppointmentRow, amount: LineAmount): AppointmentOption {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.name ?? 'Unknown client',
    scheduled_date: row.scheduled_date,
    scheduled_start_time: row.scheduled_start_time,
    job_name: row.jobs.name,
    resolved_amount_cents: amount.amount_cents,
    resolved_rate_cents: amount.rate_cents,
    resolved_minutes: amount.minutes,
    price_override_cents: row.price_override_cents,
    location_label: row.client_locations?.label ?? null,
    location_address: row.client_locations?.address ?? null,
  }
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: invoice, error: invoiceError },
    { data: clients, error: clientsError },
    { data: linkedRows, error: linkedRowsError },
    { data: allLinkedRows, error: allLinkedRowsError },
    { data: availableRows, error: availableRowsError },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, client_id, due_date, notes, status')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('id, name')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('name', { ascending: true }),
    supabase
      .from('invoice_appointments')
      .select('appointment_id, billed_amount_cents, billed_rate_cents, billed_minutes')
      .eq('invoice_id', id),
    // A released row (a line on a voided invoice) is a historical record and no longer claims its appointment.
    supabase
      .from('invoice_appointments')
      .select('invoice_id, appointment_id')
      .eq('is_archived', false),
    supabase
      .from('appointments')
      .select(appointmentSelect)
      .eq('is_archived', false)
      .order('scheduled_date', { ascending: false }),
  ])

  if (invoiceError || !invoice || invoice.status !== 'draft') {
    notFound()
  }

  let loadErrorMessage =
    (clientsError ?? linkedRowsError ?? allLinkedRowsError ?? availableRowsError)?.message ?? null

  const billedLines = linkedRows ?? []
  const linkedAppointmentIds = billedLines.map((row) => row.appointment_id)

  let linkedAppointments: AppointmentRow[] = []
  if (!loadErrorMessage && linkedAppointmentIds.length > 0) {
    const { data: linkedAppointmentsData, error: linkedAppointmentsError } = await supabase
      .from('appointments')
      .select(appointmentSelect)
      .in('id', linkedAppointmentIds)

    if (linkedAppointmentsError) {
      loadErrorMessage = linkedAppointmentsError.message
    }

    linkedAppointments = (linkedAppointmentsData ?? []) as unknown as AppointmentRow[]
  }

  const currentLinkedIds = new Set(linkedAppointmentIds)
  const linkedToOtherInvoices = new Set(
    (allLinkedRows ?? [])
      .filter((row) => row.invoice_id !== id)
      .map((row) => row.appointment_id)
  )

  const selectableRows = ((availableRows ?? []) as unknown as AppointmentRow[]).filter(
    (row) => !linkedToOtherInvoices.has(row.id) || currentLinkedIds.has(row.id)
  )

  let rulesByPair = new Map<string, ClientJobRule[]>()
  if (!loadErrorMessage) {
    try {
      rulesByPair = await fetchClientJobRules(
        supabase,
        selectableRows.map((row) => ({ clientId: row.client_id, jobId: row.jobs.id }))
      )
    } catch {
      loadErrorMessage = 'Failed to load client pricing rules.'
    }
  }

  const availableAppointments = selectableRows.map((row) =>
    toAppointmentOption(
      row,
      resolveAppointmentPrice({
        job: row.jobs,
        rule: pickEffectiveRule(rulesByPair.get(`${row.client_id}:${row.jobs.id}`) ?? [], row.scheduled_date),
        minutes: durationMinutes(row.scheduled_start_time, row.scheduled_end_time),
        appointmentOverrideCents: row.price_override_cents,
      })
    )
  )

  const frozenByAppointmentId = new Map(billedLines.map((line) => [line.appointment_id, line]))
  const preselectedAppointments: AppointmentOption[] = []

  for (const row of linkedAppointments) {
    const frozen = frozenByAppointmentId.get(row.id)

    if (frozen) {
      preselectedAppointments.push(
        toAppointmentOption(row, {
          amount_cents: frozen.billed_amount_cents,
          rate_cents: frozen.billed_rate_cents,
          minutes: frozen.billed_minutes,
        })
      )
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div className="space-y-3">
          <Link
            href={`/solutions/invoices/${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Invoice
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Edit Invoice Draft</h1>
            <p className="mt-2 text-sm text-neutral-600">Adjust appointments, pricing, due date, and notes.</p>
          </div>
        </div>
      </section>

      {loadErrorMessage ? (
        <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadErrorMessage}
        </section>
      ) : (
        <InvoiceForm
          clients={(clients ?? []).map((client) => ({ id: client.id, name: client.name }))}
          availableAppointments={availableAppointments}
          preselectedAppointments={preselectedAppointments}
          invoice={{
            id: invoice.id,
            client_id: invoice.client_id,
            due_date: invoice.due_date,
            notes: invoice.notes,
            status: invoice.status,
          }}
        />
      )}
    </div>
  )
}
