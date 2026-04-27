import Link from 'next/link'
import { AlertCircle, CalendarDays, FileText, Users } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void'
type InvoiceEffectiveStatus = InvoiceStatus | 'overdue'

type TodayAppointmentRow = {
    id: string
    scheduled_date: string
    scheduled_start_time: string
    scheduled_end_time: string
    status: AppointmentStatus
    clients: { name: string } | { name: string }[] | null
    jobs: { name: string } | { name: string }[] | null
    client_locations: { label: string | null; address: string } | Array<{ label: string | null; address: string }> | null
    appointment_employees:
        | Array<{
            employees: { full_name: string } | { full_name: string }[] | null
        }>
        | null
}

type RecentInvoiceRow = {
    id: string
    status: InvoiceStatus
    total_cents: number
    created_at: string
    due_date: string | null
    clients: { name: string } | { name: string }[] | null
}

type UpcomingAppointmentRow = {
    id: string
    scheduled_date: string
    scheduled_start_time: string
    status: AppointmentStatus
    clients: { name: string } | { name: string }[] | null
    jobs: { name: string } | { name: string }[] | null
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
}

function relationName(value: { name: string } | { name: string }[] | null): string {
    if (!value) {
        return 'Unknown'
    }

    if (Array.isArray(value)) {
        return value[0]?.name ?? 'Unknown'
    }

    return value.name
}

function relationLocation(
    value: { label: string | null; address: string } | Array<{ label: string | null; address: string }> | null,
): { label: string | null; address: string } | null {
    if (!value) {
        return null
    }

    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value
}

function invoiceRef(id: string): string {
    return `INV-${id.slice(0, 8).toUpperCase()}`
}

function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(cents / 100)
}

function parseDateOnly(value: string): Date {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}

function formatCreatedAtDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value))
}

function formatDateLabel(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(parseDateOnly(value))
}

function formatLongDate(value: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(value)
}

function formatTime(value: string): string {
    const [hours, minutes] = value.split(':').map(Number)
    const date = new Date(2000, 0, 1, hours, minutes)

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date)
}

function statusBadgeClasses(status: InvoiceEffectiveStatus): string {
    if (status === 'draft') {
        return 'border border-blue-200 bg-blue-50 text-blue-700'
    }

    if (status === 'issued') {
        return 'border border-amber-200 bg-amber-50 text-amber-700'
    }

    if (status === 'paid') {
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    }

    if (status === 'overdue') {
        return 'border border-red-200 bg-red-50 text-red-700'
    }

    return 'border border-neutral-200 bg-neutral-100 text-neutral-700'
}

function appointmentStatusBadgeClasses(status: AppointmentStatus): string {
    if (status === 'in_progress') {
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    }

    if (status === 'completed') {
        return 'border border-neutral-200 bg-neutral-100 text-neutral-700'
    }

    if (status === 'cancelled') {
        return 'border border-red-200 bg-red-50 text-red-600'
    }

    return 'border border-blue-200 bg-blue-50 text-blue-700'
}

function invoiceEffectiveStatus(invoice: RecentInvoiceRow, today: string): InvoiceEffectiveStatus {
    if (invoice.status === 'issued' && invoice.due_date && invoice.due_date < today) {
        return 'overdue'
    }

    return invoice.status
}

function assignedEmployeeNames(row: TodayAppointmentRow): string {
    if (!row.appointment_employees || row.appointment_employees.length === 0) {
        return 'Unassigned'
    }

    const names = row.appointment_employees
        .map((assignment) => {
            if (!assignment.employees) {
                return null
            }

            if (Array.isArray(assignment.employees)) {
                return assignment.employees[0]?.full_name ?? null
            }

            return assignment.employees.full_name
        })
        .filter((name): name is string => Boolean(name))

    if (names.length === 0) {
        return 'Unassigned'
    }

    return names.join(', ')
}

export default async function DashboardPage() {
    const supabase = await createClient()

    const today = new Date().toISOString().split('T')[0]
    const todayDate = new Date()
    const sevenDaysOut = new Date(todayDate)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
    const sevenDaysOutStr = sevenDaysOut.toISOString().split('T')[0]
    const tomorrowDate = new Date(todayDate)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0]

    const [
        todayAppointmentsResult,
        openInvoicesResult,
        overdueInvoicesResult,
        activeClientsResult,
        recentInvoicesResult,
        upcomingAppointmentsResult,
    ] = await Promise.all([
        supabase
            .from('appointments')
            .select(`id, scheduled_date, scheduled_start_time, scheduled_end_time, status,
      clients!inner(name), jobs!inner(name),
      client_locations(label, address),
      appointment_employees(employees!inner(full_name))`)
            .eq('scheduled_date', today)
            .neq('status', 'cancelled')
            .eq('is_archived', false)
            .order('scheduled_start_time'),

        supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'issued')
            .eq('is_archived', false),

        supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'issued')
            .lt('due_date', today)
            .eq('is_archived', false),

        supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('is_archived', false),

        supabase
            .from('invoices')
            .select(`id, status, total_cents, created_at, due_date, clients!inner(name)`)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
            .limit(5),

        supabase
            .from('appointments')
            .select(`id, scheduled_date, scheduled_start_time, status,
      clients!inner(name), jobs!inner(name)`)
            .gte('scheduled_date', tomorrowStr)
            .lte('scheduled_date', sevenDaysOutStr)
            .neq('status', 'cancelled')
            .eq('is_archived', false)
            .order('scheduled_date')
            .order('scheduled_start_time')
            .limit(8),
    ])

    const loadError =
        todayAppointmentsResult.error ??
        openInvoicesResult.error ??
        overdueInvoicesResult.error ??
        activeClientsResult.error ??
        recentInvoicesResult.error ??
        upcomingAppointmentsResult.error

    const todayAppointments = (todayAppointmentsResult.data ?? []) as unknown as TodayAppointmentRow[]
    const recentInvoices = (recentInvoicesResult.data ?? []) as unknown as RecentInvoiceRow[]
    const upcomingAppointments = (upcomingAppointmentsResult.data ?? []) as unknown as UpcomingAppointmentRow[]

    const todayAppointmentsCount = todayAppointments.length
    const openInvoicesCount = openInvoicesResult.count ?? 0
    const overdueInvoicesCount = overdueInvoicesResult.count ?? 0
    const activeClientsCount = activeClientsResult.count ?? 0

    return (
        <div className="space-y-6 sm:space-y-8">
            <section className="rounded-3xl border border-emerald-900/40 bg-linear-to-br from-emerald-950 via-emerald-900 to-neutral-900 px-5 py-6 sm:px-8 sm:py-7 shadow-lg shadow-emerald-950/20">
                <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-emerald-200/85">Admin Dashboard</p>
                <h1 className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {getGreeting()}, {formatLongDate(todayDate)}
                </h1>
            </section>

            {loadError ? (
                <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError.message}</section>
            ) : null}

            <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Link
                    href="/solutions/appointments"
                    className="group rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5 shadow-sm shadow-emerald-950/5 transition-colors hover:border-emerald-300 flex flex-col"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <CalendarDays className="size-4 sm:size-5" aria-hidden="true" />
                        </span>
                    </div>
                    <p className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950">{todayAppointmentsCount}</p>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-700">Today&apos;s Appointments</p>
                    <p className="hidden md:flex mt-1 text-[10px] sm:text-xs text-neutral-500 leading-snug">Scheduled and in-progress jobs for today.</p>
                </Link>

                <Link
                    href="/solutions/invoices"
                    className="group rounded-2xl border border-amber-200 bg-white p-4 sm:p-5 shadow-sm shadow-emerald-950/5 transition-colors hover:border-amber-300 flex flex-col"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <FileText className="size-4 sm:size-5" aria-hidden="true" />
                        </span>
                        {overdueInvoicesCount > 0 ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase tracking-wide text-red-700 whitespace-nowrap">
                                {overdueInvoicesCount} overdue
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 sm:mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950">{openInvoicesCount}</p>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-700">Open Invoices</p>
                    <p className="hidden md:flex mt-1 text-[10px] sm:text-xs text-neutral-500 leading-snug">Issued invoices pending payment.</p>
                </Link>

                <Link
                    href="/solutions/invoices?status=overdue"
                    className="group rounded-2xl border border-red-200 bg-white p-4 sm:p-5 shadow-sm shadow-emerald-950/5 transition-colors hover:border-red-300 flex flex-col"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
                            <AlertCircle className="size-4 sm:size-5" aria-hidden="true" />
                        </span>
                    </div>
                    <p className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950">{overdueInvoicesCount}</p>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-700">Overdue Invoices</p>
                    <p className="hidden md:flex mt-1 text-[10px] sm:text-xs text-neutral-500 leading-snug">Needs follow-up for late payment.</p>
                </Link>

                <Link
                    href="/solutions/clients"
                    className="group rounded-2xl border border-blue-200 bg-white p-4 sm:p-5 shadow-sm shadow-emerald-950/5 transition-colors hover:border-blue-300 flex flex-col"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Users className="size-4 sm:size-5" aria-hidden="true" />
                        </span>
                    </div>
                    <p className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950">{activeClientsCount}</p>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-700">Active Clients</p>
                    <p className="hidden md:flex mt-1 text-[10px] sm:text-xs text-neutral-500 leading-snug">Clients available for new bookings.</p>
                </Link>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                <article className="rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-emerald-950/5 flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
                        <h2 className="text-base font-semibold text-neutral-950">Today&apos;s Schedule</h2>
                        <Link href="/solutions/appointments" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 shrink-0">
                            View all appointments
                        </Link>
                    </div>

                    <div className="divide-y divide-neutral-100">
                        {todayAppointments.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-neutral-500">No appointments scheduled for today.</p>
                        ) : (
                            todayAppointments.slice(0, 10).map((appointment) => {
                                const clientName = relationName(appointment.clients)
                                const jobName = relationName(appointment.jobs)
                                const location = relationLocation(appointment.client_locations)

                                return (
                                    <Link
                                        key={appointment.id}
                                        href={`/solutions/appointments/${appointment.id}`}
                                        className="block px-5 py-4 transition-colors hover:bg-neutral-50"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[0.7rem] sm:text-xs font-semibold text-emerald-700 whitespace-nowrap">
                                                    {formatTime(appointment.scheduled_start_time)} - {formatTime(appointment.scheduled_end_time)}
                                                </span>
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-wide shrink-0 ${appointmentStatusBadgeClasses(
                                                        appointment.status,
                                                    )}`}
                                                >
                                                    {appointment.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-neutral-950">{jobName}</p>
                                                <p className="truncate text-sm text-neutral-600">
                                                    {clientName}
                                                </p>
                                                {location ? (
                                                    <p className="truncate text-xs text-neutral-500 mt-0.5">
                                                        {location.label ? `${location.label} - ` : ''}
                                                        {location.address}
                                                    </p>
                                                ) : null}
                                                <p className="truncate text-xs text-neutral-400 mt-0.5">{assignedEmployeeNames(appointment)}</p>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })
                        )}
                    </div>
                </article>

                <article className="rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-emerald-950/5 flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-4">
                        <h2 className="text-base font-semibold text-neutral-950">Recent Invoices</h2>
                        <Link href="/solutions/invoices" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 shrink-0">
                            View all invoices
                        </Link>
                    </div>

                    <div className="divide-y divide-neutral-100">
                        {recentInvoices.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-neutral-500">No invoices found.</p>
                        ) : (
                            recentInvoices.map((invoice) => {
                                const effectiveStatus = invoiceEffectiveStatus(invoice, today)

                                return (
                                    <Link
                                        key={invoice.id}
                                        href={`/solutions/invoices/${invoice.id}`}
                                        className="block px-5 py-4 transition-colors hover:bg-neutral-50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 space-y-1">
                                                <p className="text-sm font-semibold text-neutral-950 truncate">{invoiceRef(invoice.id)}</p>
                                                <p className="truncate text-sm text-neutral-600">{relationName(invoice.clients)}</p>
                                                <p className="text-xs text-neutral-500">Created {formatCreatedAtDate(invoice.created_at)}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-wide ${statusBadgeClasses(
                                                        effectiveStatus,
                                                    )}`}
                                                >
                                                    {effectiveStatus}
                                                </span>
                                                <p className="mt-2 text-sm font-semibold text-neutral-950">{formatCurrency(invoice.total_cents)}</p>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })
                        )}
                    </div>
                </article>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-emerald-950/5">
                <div className="border-b border-neutral-100 px-5 py-4">
                    <h2 className="text-base font-semibold text-neutral-950">Upcoming This Week</h2>
                </div>

                <div className="divide-y divide-neutral-100">
                    {upcomingAppointments.length === 0 ? (
                        <p className="px-5 py-8 text-sm text-neutral-500">No upcoming appointments this week.</p>
                    ) : (
                        upcomingAppointments.map((appointment) => (
                            <Link
                                key={appointment.id}
                                href={`/solutions/appointments/${appointment.id}`}
                                className="block px-5 py-4 transition-colors hover:bg-neutral-50"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 space-y-1">
                                        <p className="truncate text-sm font-semibold text-neutral-950">{relationName(appointment.jobs)}</p>
                                        <p className="truncate text-sm text-neutral-600">{relationName(appointment.clients)}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-medium text-neutral-800">{formatDateLabel(appointment.scheduled_date)}</p>
                                        <p className="text-xs text-neutral-500">{formatTime(appointment.scheduled_start_time)}</p>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </div>
    )
}