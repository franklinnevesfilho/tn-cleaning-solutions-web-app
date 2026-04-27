import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Calendar, Clock, CheckCircle, Briefcase } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'

import { WorkSessionsList } from '@/components/employee/work-sessions-list'
import { createClient } from '@/lib/supabase/server'

type TimeSheetRecord = {
  id: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  appointments: {
    scheduled_date: string
    clients: {
      name: string
    }
    jobs: {
      name: string
    }
  }
}

type EmployeeRecord = {
  id: string
  full_name: string
}

type DurationResult = {
  hours: number
  minutes: number
  totalMinutes: number
  isComplete: boolean
}

function calculateDuration(clockedIn: string | null, clockedOut: string | null): DurationResult {
  if (!clockedIn) {
    return { hours: 0, minutes: 0, totalMinutes: 0, isComplete: false }
  }

  const startedAt = new Date(clockedIn)
  const endedAt = clockedOut ? new Date(clockedOut) : new Date()
  const totalMinutes = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / (1000 * 60)))

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    totalMinutes,
    isComplete: clockedOut !== null,
  }
}

function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) {
    return '0m'
  }

  if (hours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function compareRecords(left: TimeSheetRecord, right: TimeSheetRecord) {
  const leftDate = new Date(`${left.appointments.scheduled_date}T${left.clocked_in_at ?? '00:00:00'}`)
  const rightDate = new Date(`${right.appointments.scheduled_date}T${right.clocked_in_at ?? '00:00:00'}`)

  return rightDate.getTime() - leftDate.getTime()
}

export default async function TimeSheetsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee } = await supabase.from('employees').select('id, full_name').eq('user_id', user.id).single<EmployeeRecord>()

  if (!employee) {
    notFound()
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const monthStartLabel = format(monthStart, 'yyyy-MM-dd')
  const monthEndLabel = format(monthEnd, 'yyyy-MM-dd')

  const { data: timeSheets, error } = await supabase
    .from('appointment_employees')
    .select(
      `
        id,
        clocked_in_at,
        clocked_out_at,
        appointments!inner (
          scheduled_date,
          clients!inner (
            name
          ),
          jobs!inner (
            name
          )
        )
      `
    )
    .eq('employee_id', employee.id)
    .not('clocked_in_at', 'is', null)

  if (error) {
    console.error('Error fetching time sheets:', error)
  }

  const records = ((timeSheets ?? []) as unknown as TimeSheetRecord[])
    .filter((record) => record.appointments.scheduled_date >= monthStartLabel && record.appointments.scheduled_date <= monthEndLabel)
    .sort(compareRecords)

  const totalAppointments = records.length
  const totalMinutes = records.reduce((sum, record) => sum + calculateDuration(record.clocked_in_at, record.clocked_out_at).totalMinutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalRemainingMinutes = totalMinutes % 60
  const averageMinutes = totalAppointments > 0 ? Math.floor(totalMinutes / totalAppointments) : 0
  const averageHours = Math.floor(averageMinutes / 60)
  const averageRemainingMinutes = averageMinutes % 60

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-white/90 p-6 shadow-sm shadow-emerald-950/5 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_36%),linear-gradient(135deg,rgba(16,185,129,0.05),transparent_60%)]" />
        <div className="relative space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Employee work history</p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">Time Sheets</h1>
            <p className="max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
              A clean record of your clocked work sessions for {format(now, 'MMMM yyyy')}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'Appointments', value: totalAppointments.toString(), icon: Briefcase },
              { label: 'Total Hours', value: formatDuration(totalHours, totalRemainingMinutes), icon: Clock },
              { label: 'Avg per Job', value: totalAppointments > 0 ? formatDuration(averageHours, averageRemainingMinutes) : '—', icon: CheckCircle },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 shadow-sm shadow-emerald-950/5 backdrop-blur sm:rounded-2xl sm:px-4 sm:py-3">
                <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-neutral-500 sm:text-xs">
                  <stat.icon className="size-3 text-emerald-600 sm:size-3.5" aria-hidden="true" />
                  <span>{stat.label}</span>
                </div>
                <p className="mt-0.5 text-xl font-semibold text-neutral-950 sm:mt-1 sm:text-2xl">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WorkSessionsList records={records} />
    </div>
  )
}