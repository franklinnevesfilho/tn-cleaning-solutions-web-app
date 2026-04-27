import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { InvoiceForm, type AppointmentOption } from '@/components/admin/invoice-form'
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
  jobs: { id: string; name: string; base_price_cents: number } | null
  client_locations: { label: string; address: string } | null
  clients: { id: string; name: string } | null
}

function toAppointmentOption(row: AppointmentRow): AppointmentOption {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.name ?? 'Unknown client',
    scheduled_date: row.scheduled_date,
    scheduled_start_time: row.scheduled_start_time,
    job_name: row.jobs?.name ?? 'Unknown job',
    job_base_price_cents: row.jobs?.base_price_cents ?? 0,
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
    supabase.from('invoice_appointments').select('appointment_id').eq('invoice_id', id),
    supabase.from('invoice_appointments').select('invoice_id, appointment_id'),
    supabase
      .from('appointments')
      .select(
        `
          id, client_id, scheduled_date, scheduled_start_time, scheduled_end_time,
          price_override_cents,
          jobs!inner ( id, name, base_price_cents ),
          client_locations ( label, address ),
          clients!inner ( id, name )
        `
      )
      .eq('is_archived', false)
      .order('scheduled_date', { ascending: false }),
  ])

  if (invoiceError || !invoice || invoice.status !== 'draft') {
    notFound()
  }

  const loadError =
    clientsError ??
    linkedRowsError ??
    allLinkedRowsError ??
    availableRowsError

  if (loadError) {
    throw new Error(loadError.message)
  }

  const linkedAppointmentIds = (linkedRows ?? []).map((row) => row.appointment_id)

  let linkedAppointments: AppointmentRow[] = []
  if (linkedAppointmentIds.length > 0) {
    const { data: linkedAppointmentsData, error: linkedAppointmentsError } = await supabase
      .from('appointments')
      .select(
        `
          id, client_id, scheduled_date, scheduled_start_time, scheduled_end_time,
          price_override_cents,
          jobs!inner ( id, name, base_price_cents ),
          client_locations ( label, address ),
          clients!inner ( id, name )
        `
      )
      .in('id', linkedAppointmentIds)

    if (linkedAppointmentsError) {
      throw new Error(linkedAppointmentsError.message)
    }

    linkedAppointments = (linkedAppointmentsData ?? []) as unknown as AppointmentRow[]
  }

  const currentLinkedIds = new Set((linkedRows ?? []).map((row) => row.appointment_id))
  const linkedToOtherInvoices = new Set(
    (allLinkedRows ?? [])
      .filter((row) => row.invoice_id !== id)
      .map((row) => row.appointment_id)
  )

  const preselectedAppointments = linkedAppointments.map(toAppointmentOption)

  const availableAppointments = ((availableRows ?? []) as unknown as AppointmentRow[])
    .filter((row) => !linkedToOtherInvoices.has(row.id) || currentLinkedIds.has(row.id))
    .map(toAppointmentOption)

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
    </div>
  )
}
