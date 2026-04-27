import { endOfMonth, format, startOfMonth } from 'date-fns'

import { AppointmentsViewToggle } from '@/components/admin/appointments-view-toggle'
import type { AppointmentSummary } from '@/components/admin/appointments-types'
import { createClient } from '@/lib/supabase/server'

type AppointmentsPageProps = {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[] }>
}

type RawAppointmentRow = {
  id: string
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  price_override_cents: number | null
  clients: { id: string; name: string } | null
  jobs: { id: string; name: string; base_price_cents: number } | null
  client_locations: { label: string; address: string } | null
  appointment_employees:
    | Array<{
        id: string
        employee_id: string
        employees: { full_name: string } | null
      }>
    | null
}

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseMonth(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return fallback
  }

  return parsed
}

function parseYear(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return fallback
  }

  return parsed
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const now = new Date()
  const params = await searchParams

  const month = parseMonth(normalizeParam(params.month), now.getMonth() + 1)
  const year = parseYear(normalizeParam(params.year), now.getFullYear())

  const selectedMonthDate = new Date(year, month - 1, 1)
  const firstDayOfMonth = format(startOfMonth(selectedMonthDate), 'yyyy-MM-dd')
  const lastDayOfMonth = format(endOfMonth(selectedMonthDate), 'yyyy-MM-dd')

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `
        id, scheduled_date, scheduled_start_time, scheduled_end_time,
        status, notes, price_override_cents,
        clients!inner ( id, name ),
        jobs!inner ( id, name, base_price_cents ),
        client_locations ( label, address ),
        appointment_employees ( id, employee_id, employees!inner ( full_name ) )
      `
    )
    .eq('is_archived', false)
    .gte('scheduled_date', firstDayOfMonth)
    .lte('scheduled_date', lastDayOfMonth)
    .order('scheduled_date')
    .order('scheduled_start_time')

  const appointments: AppointmentSummary[] = (data as RawAppointmentRow[] | null)?.map((row) => ({
    id: row.id,
    scheduled_date: row.scheduled_date,
    scheduled_start_time: row.scheduled_start_time,
    scheduled_end_time: row.scheduled_end_time,
    status: row.status,
    notes: row.notes,
    price_override_cents: row.price_override_cents,
    client: {
      id: row.clients?.id ?? '',
      name: row.clients?.name ?? 'Unknown client',
    },
    job: {
      id: row.jobs?.id ?? '',
      name: row.jobs?.name ?? 'Unknown job',
      base_price_cents: row.jobs?.base_price_cents ?? 0,
    },
    location: row.client_locations,
    assignedEmployees: (row.appointment_employees ?? []).map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employee_id,
      full_name: assignment.employees?.full_name ?? 'Unknown employee',
    })),
  })) ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Appointments</h1>
          <p className="mt-2 text-sm text-neutral-600">Plan, assign, and track appointments across your team.</p>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </section>
      ) : null}

      <AppointmentsViewToggle appointments={appointments} month={month} year={year} />
    </div>
  )
}
