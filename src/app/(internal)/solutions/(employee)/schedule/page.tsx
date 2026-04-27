import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
	ArrowRight,
	Calendar,
	CheckCircle,
	Clock,
	Phone,
	User,
} from 'lucide-react'
import { format, isSameDay, parseISO, startOfDay, subDays } from 'date-fns'

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

type ClockStatus = 'clocked_in' | 'clocked_out' | 'not_started'

type AppointmentRecord = {
	appointment_id: string
	clocked_in_at: string | null
	clocked_out_at: string | null
	appointments: {
		id: string
		scheduled_date: string
		scheduled_start_time: string
		scheduled_end_time: string
		status: AppointmentStatus
		notes: string
		clients: {
			name: string
			phone: string | null
		}
		client_locations: {
			label: string
			address: string
		} | null
		jobs: {
			name: string
			description: string | null
		}
	}
}

type TeamMemberRecord = {
	appointment_id: string
	clocked_in_at: string | null
	clocked_out_at: string | null
	employees: {
		id: string
		full_name: string
		phone: string | null
	}
}

type EmployeeSummary = {
	id: string
	full_name: string
	phone: string | null
}

type AppointmentWithTeam = AppointmentRecord & {
	teamMembers: Array<{
		id: string
		full_name: string
		phone: string | null
		clocked_in_at: string | null
		clocked_out_at: string | null
		clockStatus: ClockStatus
	}>
	currentUserClockStatus: ClockStatus
	currentUserClockedInAt: string | null
	currentUserClockedOutAt: string | null
}

function getClockStatus(clockedInAt: string | null, clockedOutAt: string | null): ClockStatus {
	if (clockedOutAt) {
		return 'clocked_out'
	}

	if (clockedInAt) {
		return 'clocked_in'
	}

	return 'not_started'
}

function formatDateLabel(dateString: string) {
	return format(parseISO(dateString), 'EEE, MMM d')
}

function formatTimeLabel(dateString: string, timeString: string) {
	return format(new Date(`${dateString}T${timeString}`), 'h:mm a')
}

function sortAppointments(appointments: AppointmentWithTeam[]) {
	return [...appointments].sort((left, right) => {
		const leftDate = new Date(`${left.appointments.scheduled_date}T${left.appointments.scheduled_start_time}`)
		const rightDate = new Date(`${right.appointments.scheduled_date}T${right.appointments.scheduled_start_time}`)

		return leftDate.getTime() - rightDate.getTime()
	})
}

function groupAppointments(appointments: AppointmentWithTeam[]) {
	const today = startOfDay(new Date())
	const tomorrow = new Date(today)
	tomorrow.setDate(tomorrow.getDate() + 1)
	const weekAgo = subDays(today, 7)

	return {
		today: appointments.filter((appointment) =>
			isSameDay(parseISO(appointment.appointments.scheduled_date), today)
		),
		upcoming: appointments.filter((appointment) => parseISO(appointment.appointments.scheduled_date) >= tomorrow),
		recent: appointments.filter((appointment) => {
			const appointmentDate = parseISO(appointment.appointments.scheduled_date)
			return appointmentDate < today && appointmentDate >= weekAgo
		}),
	}
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
	const styles = {
		scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
		in_progress: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		completed: 'border-neutral-200 bg-neutral-100 text-neutral-600',
		cancelled: 'border-red-200 bg-red-50 text-red-700',
	}

	const labels = {
		scheduled: 'Scheduled',
		in_progress: 'In Progress',
		completed: 'Completed',
		cancelled: 'Cancelled',
	}

	return (
		<span className={cn('rounded-full border px-2 py-1 text-xs font-medium tracking-tight', styles[status])}>
			{labels[status]}
		</span>
	)
}

function ClockStatusPill({
	status,
	clockedInAt,
	clockedOutAt,
	isCurrentUser = false,
}: {
	status: ClockStatus
	clockedInAt: string | null
	clockedOutAt: string | null
	isCurrentUser?: boolean
}) {
	const styles = {
		clocked_in: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		clocked_out: 'border-neutral-200 bg-neutral-100 text-neutral-600',
		not_started: 'border-amber-200 bg-amber-50 text-amber-700',
	}

	const labels = {
		clocked_in: clockedInAt ? `Clocked in at ${format(new Date(clockedInAt), 'h:mm a')}` : 'Clocked in',
		clocked_out: clockedOutAt ? `Clocked out at ${format(new Date(clockedOutAt), 'h:mm a')}` : 'Clocked out',
		not_started: 'Not started',
	}

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.7rem] font-medium tracking-tight',
				styles[status],
				isCurrentUser && 'ring-1 ring-emerald-500/20'
			)}
		>
			{status === 'clocked_in' ? <CheckCircle className="size-3" aria-hidden="true" /> : <Clock className="size-3" aria-hidden="true" />}
			{labels[status]}
		</span>
	)
}

function CompactAppointmentCard({
	appointment,
	currentEmployee,
}: {
	appointment: AppointmentWithTeam
	currentEmployee: EmployeeSummary
}) {
	const client = appointment.appointments.clients
	const job = appointment.appointments.jobs
	const currentMember = appointment.teamMembers.find((member) => member.id === currentEmployee.id)
	const clockStatus = currentMember?.clockStatus ?? appointment.currentUserClockStatus

	return (
		<Link
			href={`/solutions/schedule/${appointment.appointments.id}`}
			className="group block rounded-xl border border-emerald-100 bg-white/95 p-4 shadow-sm shadow-emerald-950/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-950/10"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex items-center gap-2 text-xs text-neutral-600">
						<Calendar className="size-3.5 text-emerald-600" aria-hidden="true" />
						<span className="font-medium text-neutral-900">{formatDateLabel(appointment.appointments.scheduled_date)}</span>
					</div>
					<h3 className="truncate text-base font-semibold text-neutral-950">{job.name}</h3>
					<p className="truncate text-sm text-neutral-600">{client.name}</p>
					<div className="flex items-center gap-2 text-xs text-neutral-500">
						<Clock className="size-3.5 text-neutral-400" aria-hidden="true" />
						<span>
							{formatTimeLabel(appointment.appointments.scheduled_date, appointment.appointments.scheduled_start_time)} - {formatTimeLabel(appointment.appointments.scheduled_date, appointment.appointments.scheduled_end_time)}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-2">
					<StatusBadge status={appointment.appointments.status} />
					<ClockStatusPill
						status={clockStatus}
						clockedInAt={currentMember?.clocked_in_at ?? appointment.currentUserClockedInAt}
						clockedOutAt={currentMember?.clocked_out_at ?? appointment.currentUserClockedOutAt}
						isCurrentUser
					/>
				</div>
			</div>
		</Link>
	)
}

function AppointmentCard({
	appointment,
	currentEmployee,
}: {
	appointment: AppointmentWithTeam
	currentEmployee: EmployeeSummary
}) {
	const client = appointment.appointments.clients
	const job = appointment.appointments.jobs
	const currentMember = appointment.teamMembers.find((member) => member.id === currentEmployee.id)
	const clockStatus = currentMember?.clockStatus ?? appointment.currentUserClockStatus

	return (
		<Card className="group border-emerald-100 bg-white/95 shadow-sm shadow-emerald-950/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-950/10">
			<CardHeader className="space-y-3 border-b border-emerald-50 pb-4">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0 space-y-1">
						<div className="flex items-center gap-2 text-sm text-neutral-600">
							<Calendar className="size-4 text-emerald-600" aria-hidden="true" />
							<span className="font-medium text-neutral-900">{formatDateLabel(appointment.appointments.scheduled_date)}</span>
						</div>
						<h3 className="truncate text-lg font-semibold text-neutral-950">{job.name}</h3>
					</div>
					<StatusBadge status={appointment.appointments.status} />
				</div>
				<div className="flex items-center gap-2 text-sm text-neutral-600">
					<Clock className="size-4 text-neutral-400" aria-hidden="true" />
					<span>
						{formatTimeLabel(appointment.appointments.scheduled_date, appointment.appointments.scheduled_start_time)} - {formatTimeLabel(appointment.appointments.scheduled_date, appointment.appointments.scheduled_end_time)}
					</span>
				</div>
			</CardHeader>

			<CardContent className="space-y-5 py-4">
				<div className="space-y-2">
					<p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">Client & job</p>
					<div className="space-y-1">
						<h4 className="text-base font-semibold text-neutral-950">{client.name}</h4>
						{job.description ? <p className="text-sm leading-6 text-neutral-600">{job.description}</p> : null}
						{appointment.appointments.client_locations?.address ? (
							<p className="text-sm text-neutral-500">{appointment.appointments.client_locations.address}</p>
						) : null}
					</div>
					<div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
						{client.phone ? (
							<a
								href={`tel:${client.phone}`}
								className="inline-flex items-center gap-1.5 text-emerald-700 transition-colors hover:text-emerald-800"
							>
								<Phone className="size-4" aria-hidden="true" />
								<span>{client.phone}</span>
							</a>
						) : null}
					</div>
				</div>

				<div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Your clock status</p>
							<p className="mt-1 text-sm text-neutral-700">
								{clockStatus === 'clocked_in'
									? 'You are currently on the job.'
									: clockStatus === 'clocked_out'
										? 'You have already clocked out.'
										: 'You have not started this appointment yet.'}
							</p>
						</div>
						<ClockStatusPill
							status={clockStatus}
							clockedInAt={currentMember?.clocked_in_at ?? appointment.currentUserClockedInAt}
							clockedOutAt={currentMember?.clocked_out_at ?? appointment.currentUserClockedOutAt}
							isCurrentUser
						/>
					</div>
				</div>

				<div className="space-y-3 border-t border-emerald-50 pt-4">
					<div className="flex items-center justify-between gap-3">
						<h4 className="text-sm font-semibold text-neutral-700">Team members ({appointment.teamMembers.length})</h4>
						<span className="text-xs text-neutral-500">Assigned crew for this stop</span>
					</div>
					<div className="space-y-2">
						{appointment.teamMembers.map((member) => {
							const isCurrentUser = member.id === currentEmployee.id

							return (
								<div
									key={member.id}
									className={cn(
										'flex flex-col gap-2 rounded-2xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
										isCurrentUser ? 'border-emerald-200 bg-emerald-50/70' : 'border-neutral-200 bg-white'
									)}
								>
									<div className="min-w-0 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<User className={cn('size-4', isCurrentUser ? 'text-emerald-600' : 'text-neutral-400')} aria-hidden="true" />
											<span className={cn('text-sm font-medium text-neutral-900', isCurrentUser && 'font-semibold text-emerald-800')}>
												{member.full_name}
											</span>
											{isCurrentUser ? (
												<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">
													You
												</span>
											) : null}
										</div>
										{member.phone ? (
											<a
												href={`tel:${member.phone}`}
												className="inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-emerald-700"
											>
												<Phone className="size-3.5" aria-hidden="true" />
												<span>{member.phone}</span>
											</a>
										) : (
											<p className="text-xs text-neutral-400">No phone on file</p>
										)}
									</div>
									<ClockStatusPill
										status={member.clockStatus}
										clockedInAt={member.clocked_in_at}
										clockedOutAt={member.clocked_out_at}
										isCurrentUser={isCurrentUser}
									/>
								</div>
							)
						})}
					</div>
				</div>
			</CardContent>

			<CardFooter className="border-t border-emerald-50 py-4">
				<Link
					href={`/solutions/schedule/${appointment.appointments.id}`}
					className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
				>
					View details
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</CardFooter>
		</Card>
	)
}

function EmptyState({ title, description }: { title: string; description: string }) {
	return (
		<Card className="border-dashed border-emerald-200 bg-white/85 shadow-sm shadow-emerald-950/5">
			<CardContent className="space-y-3 py-8 text-center sm:py-10">
				<div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
					<Calendar className="size-5" aria-hidden="true" />
				</div>
				<div className="space-y-1">
					<h3 className="text-base font-semibold text-neutral-950">{title}</h3>
					<p className="text-sm text-neutral-600">{description}</p>
				</div>
				<Link
					href="/solutions/profile"
					className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
				>
					Contact admin
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</CardContent>
		</Card>
	)
}

export default async function SchedulePage() {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) {
		redirect('/login')
	}

	const { data: currentEmployee, error: currentEmployeeError } = await supabase
		.from('employees')
		.select('id, full_name, phone')
		.eq('user_id', user.id)
		.single<EmployeeSummary>()

	if (currentEmployeeError || !currentEmployee) {
		return (
			<div className="space-y-6">
				<div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 shadow-sm shadow-amber-950/5">
					<div className="flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
							<Calendar className="size-5" aria-hidden="true" />
						</div>
						<div className="space-y-2">
							<h1 className="text-2xl font-semibold text-neutral-950">Your Schedule</h1>
							<p className="max-w-2xl text-sm leading-6 text-neutral-700">
								We could not find an employee profile for this account. Contact admin so your profile can be linked before you can see assignments.
							</p>
							<Link href="/solutions/profile" className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100">
								Contact admin
								<ArrowRight className="size-3.5" aria-hidden="true" />
							</Link>
						</div>
					</div>
				</div>
			</div>
		)
	}

	const { data: currentAssignments, error: appointmentsError } = await supabase
		.from('appointment_employees')
		.select(
			`
				appointment_id,
				clocked_in_at,
				clocked_out_at,
				appointments!inner (
					id,
					scheduled_date,
					scheduled_start_time,
					scheduled_end_time,
					status,
					notes,
					clients!inner (
						name,
						phone
					),
					client_locations (
						label,
						address
					),
					jobs!inner (
						name,
						description
					)
				)
			`
		)
		.eq('employee_id', currentEmployee.id)

	if (appointmentsError) {
        console.error('Error fetching appointments:', appointmentsError)
		return (
			<div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-red-900 shadow-sm shadow-red-950/5">
				<h1 className="text-2xl font-semibold text-red-950">Your Schedule</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-red-800">
					We could not load your assignments right now. Please try again in a moment or contact admin if the problem continues.
				</p>
			</div>
		)
	}

	const appointmentRows = (currentAssignments ?? []) as unknown as AppointmentRecord[]
	const appointmentIds = appointmentRows.map((appointment) => appointment.appointment_id)

	const { data: allTeamRows, error: teamError } = appointmentIds.length
		? await supabase
			.from('appointment_employees')
			.select(
				`
					appointment_id,
					clocked_in_at,
					clocked_out_at,
					employees!inner (
						id,
						full_name,
						phone
					)
				`
			)
			.in('appointment_id', appointmentIds)
		: { data: [], error: null }

	if (teamError) {
		return (
			<div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-red-900 shadow-sm shadow-red-950/5">
				<h1 className="text-2xl font-semibold text-red-950">Your Schedule</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-red-800">
					We could not load your team assignments right now. Please try again in a moment or contact admin if the problem continues.
				</p>
			</div>
		)
	}

	const teamRows = (allTeamRows ?? []) as TeamMemberRecord[]
	const teamByAppointment = teamRows.reduce<Map<string, TeamMemberRecord[]>>((accumulator, row) => {
		const existing = accumulator.get(row.appointment_id) ?? []
		accumulator.set(row.appointment_id, [...existing, row])
		return accumulator
	}, new Map())

	const appointments: AppointmentWithTeam[] = appointmentRows.map((row) => {
		const teamMembers = teamByAppointment.get(row.appointment_id) ?? []
		const currentUserTeamMember = teamMembers.find((member) => member.employees.id === currentEmployee.id)
		const normalizedTeamMembers = teamMembers.map((member) => ({
			id: member.employees.id,
			full_name: member.employees.full_name,
			phone: member.employees.phone,
			clocked_in_at: member.clocked_in_at,
			clocked_out_at: member.clocked_out_at,
			clockStatus: getClockStatus(member.clocked_in_at, member.clocked_out_at),
		}))

		if (!normalizedTeamMembers.some((member) => member.id === currentEmployee.id)) {
			normalizedTeamMembers.push({
				id: currentEmployee.id,
				full_name: currentEmployee.full_name,
				phone: currentEmployee.phone,
				clocked_in_at: currentUserTeamMember?.clocked_in_at ?? row.clocked_in_at,
				clocked_out_at: currentUserTeamMember?.clocked_out_at ?? row.clocked_out_at,
				clockStatus: getClockStatus(
					currentUserTeamMember?.clocked_in_at ?? row.clocked_in_at,
					currentUserTeamMember?.clocked_out_at ?? row.clocked_out_at
				),
			})
		}

		return {
			...row,
			teamMembers: normalizedTeamMembers.sort((left, right) => {
				if (left.id === currentEmployee.id) return -1
				if (right.id === currentEmployee.id) return 1
				return left.full_name.localeCompare(right.full_name)
			}),
			currentUserClockStatus: getClockStatus(
				currentUserTeamMember?.clocked_in_at ?? row.clocked_in_at,
				currentUserTeamMember?.clocked_out_at ?? row.clocked_out_at
			),
			currentUserClockedInAt: currentUserTeamMember?.clocked_in_at ?? row.clocked_in_at,
			currentUserClockedOutAt: currentUserTeamMember?.clocked_out_at ?? row.clocked_out_at,
		}
	})

	const sortedAppointments = sortAppointments(appointments)
	const groupedAppointments = groupAppointments(sortedAppointments)
	const totalAppointments = sortedAppointments.length

	// Get next appointment (first from today or upcoming)
	const nextAppointment = groupedAppointments.today[0] ?? groupedAppointments.upcoming[0]
	const remainingUpcoming = nextAppointment
		? groupedAppointments.today[0]
			? [...groupedAppointments.today.slice(1), ...groupedAppointments.upcoming]
			: groupedAppointments.upcoming.slice(1)
		: []

	return (
		<div className="space-y-8">
			<section className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-white/90 p-6 shadow-sm shadow-emerald-950/5 sm:p-8">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_36%),linear-gradient(135deg,rgba(16,185,129,0.05),transparent_60%)]" />
				<div className="max-w-3xl space-y-3">
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Employee portal</p>
					<h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">Your Schedule</h1>
					<p className="max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
						View your upcoming assignments, confirm your crew, and check your clock status for each stop.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{[
							{ label: 'Today', value: groupedAppointments.today.length },
							{ label: 'Upcoming', value: groupedAppointments.upcoming.length },
							{ label: 'Recent', value: groupedAppointments.recent.length },
							{ label: 'Total', value: totalAppointments },
						].map((stat) => (
							<div key={stat.label} className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 shadow-sm shadow-emerald-950/5 backdrop-blur sm:rounded-2xl sm:px-4 sm:py-3">
								<p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-neutral-500 sm:text-xs">{stat.label}</p>
								<p className="mt-0.5 text-xl font-semibold text-neutral-950 sm:mt-1 sm:text-2xl">{stat.value}</p>
							</div>
						))}
					</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-950">Your Appointments</h2>
					<p className="text-sm text-neutral-600">Current and upcoming schedule.</p>
				</div>
				{nextAppointment ? (
					<div className="grid gap-4 lg:grid-cols-2">
						{/* Next Appointment - Full Detail */}
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white">
								</div>
								<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Next Appointment</h3>
							</div>
							<AppointmentCard appointment={nextAppointment} currentEmployee={currentEmployee} />
						</div>

						{/* Remaining Upcoming - Compact List */}
						<div className="space-y-3">
							<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-700">
								Upcoming ({remainingUpcoming.length})
							</h3>
							{remainingUpcoming.length > 0 ? (
								<div className="space-y-2 lg:max-h-150 lg:overflow-y-auto lg:pr-2">
									{remainingUpcoming.map((appointment) => (
										<CompactAppointmentCard key={appointment.appointments.id} appointment={appointment} currentEmployee={currentEmployee} />
									))}
								</div>
							) : (
								<Card className="border-dashed border-emerald-200 bg-white/85 shadow-sm shadow-emerald-950/5">
									<CardContent className="space-y-2 py-6 text-center">
										<div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
											<Calendar className="size-4" aria-hidden="true" />
										</div>
										<div className="space-y-0.5">
											<h4 className="text-sm font-semibold text-neutral-950">All caught up</h4>
											<p className="text-xs text-neutral-600">No more appointments scheduled after this one.</p>
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				) : (
					<EmptyState
						title="No appointments scheduled"
						description="You don't have any upcoming appointments. Contact admin if you expected to see work on the roster."
					/>
				)}
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-950">Recent</h2>
					<p className="text-sm text-neutral-600">Completed or past assignments from the last 7 days.</p>
				</div>
				{groupedAppointments.recent.length > 0 ? (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{groupedAppointments.recent.map((appointment) => (
							<CompactAppointmentCard key={appointment.appointments.id} appointment={appointment} currentEmployee={currentEmployee} />
						))}
					</div>
				) : (
					<EmptyState
						title="No recent appointments"
						description="There are no assignments in the last 7 days. Contact admin if you think something is missing."
					/>
				)}
			</section>
		</div>
	)
}
