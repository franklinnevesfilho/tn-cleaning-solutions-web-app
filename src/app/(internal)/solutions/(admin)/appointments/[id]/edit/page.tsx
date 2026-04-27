import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { AppointmentForm } from '@/components/admin/appointment-form'
import { createClient } from '@/lib/supabase/server'

type EditAppointmentPageProps = {
  params: Promise<{ id: string }>
}

type AppointmentRow = {
  id: string
  client_id: string
  job_id: string
  location_id: string | null
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  price_override_cents: number | null
  notes: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  is_archived: boolean
  appointment_employees: Array<{ employee_id: string }> | null
}

export default async function EditAppointmentPage({ params }: EditAppointmentPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: appointment, error: appointmentError },
    { data: clients, error: clientsError },
    { data: jobs, error: jobsError },
    { data: employees, error: employeesError },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        `
          id, client_id, job_id, location_id, scheduled_date, scheduled_start_time,
          scheduled_end_time, price_override_cents, notes, status, is_archived,
          appointment_employees(employee_id)
        `
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('id, name, client_locations(id, label, address, is_archived)')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('name', { ascending: true }),
    supabase
      .from('jobs')
      .select('id, name, base_price_cents')
      .eq('is_archived', false)
      .order('name', { ascending: true }),
    supabase
      .from('employees')
      .select('id, full_name')
      .eq('is_archived', false)
      .order('full_name', { ascending: true }),
  ])

  if (appointmentError || !appointment || appointment.is_archived) {
    notFound()
  }

  const loadError = clientsError ?? jobsError ?? employeesError

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div className="space-y-3">
          <Link
            href={`/solutions/appointments/${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Appointment
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Edit Appointment</h1>
            <p className="mt-2 text-sm text-neutral-600">Update schedule details and team assignments.</p>
          </div>
        </div>
      </section>

      {loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError.message}
        </section>
      ) : (
        <AppointmentForm
          clients={(clients ?? []).map((client) => ({
            id: client.id,
            name: client.name,
            client_locations: (client.client_locations ?? [])
              .filter((location) => !location.is_archived)
              .map((location) => ({
                id: location.id,
                label: location.label,
                address: location.address,
              })),
          }))}
          jobs={jobs ?? []}
          employees={employees ?? []}
          appointment={{
            id: appointment.id,
            client_id: appointment.client_id,
            job_id: appointment.job_id,
            location_id: appointment.location_id,
            scheduled_date: appointment.scheduled_date,
            scheduled_start_time: appointment.scheduled_start_time,
            scheduled_end_time: appointment.scheduled_end_time,
            price_override_cents: appointment.price_override_cents,
            notes: appointment.notes,
            status: appointment.status,
            assignedEmployeeIds: (appointment.appointment_employees ?? []).map((row) => row.employee_id),
          }}
        />
      )}
    </div>
  )
}
