'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Search, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { activateEmployee, deactivateEmployee } from '@/lib/actions/employees'

type EmployeeRow = {
	id: string
	user_id: string
	full_name: string
	phone: string | null
	is_active: boolean
	is_archived: boolean
}

function EmployeeCard({ employee, isCurrentUser }: { employee: EmployeeRow; isCurrentUser: boolean }) {
	const action = employee.is_active
		? deactivateEmployee.bind(null, employee.id)
		: activateEmployee.bind(null, employee.id)

	return (
		<Card className="rounded-2xl border border-neutral-200 bg-white py-0 shadow-sm shadow-emerald-950/5">
			<CardHeader className="gap-2 border-b border-neutral-100 px-5 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<CardTitle className="truncate text-base font-semibold text-neutral-950">
								{employee.full_name}
							</CardTitle>
							{isCurrentUser ? (
								<span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">
									You
								</span>
							) : null}
						</div>
						<p className="mt-1 text-sm text-neutral-600">{employee.phone || 'No phone'}</p>
					</div>
					<span
						className={`rounded-full px-2 py-1 text-xs font-medium ${
							employee.is_active
								? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
								: 'border border-neutral-200 bg-neutral-100 text-neutral-600'
						}`}
					>
						{employee.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
			</CardHeader>
			<CardFooter className="justify-between border-neutral-100 px-5 py-3">
				<Link
					href={`/solutions/employees/${employee.id}`}
					className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
				>
					View
				</Link>
				<Link
					href={`/solutions/employees/${employee.id}/time-sheets`}
					className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
				>
					Time Sheets
					<Clock className="size-3.5 text-emerald-600" aria-hidden="true" />
				</Link>
				<form action={action}>
					<Button
						type="submit"
						variant="outline"
						className={`h-8 cursor-pointer rounded-full px-3 text-xs font-medium ${
							employee.is_active
								? 'border-neutral-200 bg-white text-neutral-700 hover:bg-red-500/80'
								: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
						}`}
					>
						{employee.is_active ? 'Deactivate' : 'Activate'}
					</Button>
				</form>
			</CardFooter>
		</Card>
	)
}

export function EmployeesList({
	employees,
	currentUserId,
}: {
	employees: EmployeeRow[]
	currentUserId: string | null
}) {
	const [query, setQuery] = useState('')
	const normalizedQuery = query.trim().toLowerCase()
	const filteredEmployees = employees.filter((employee) => {
		if (!normalizedQuery) {
			return true
		}

		return (
			employee.full_name.toLowerCase().includes(normalizedQuery) ||
			employee.phone?.toLowerCase().includes(normalizedQuery)
		)
	})

	if (employees.length === 0) {
		return (
			<section className="rounded-2xl border border-emerald-100 bg-white p-10 shadow-sm shadow-emerald-950/5">
				<div className="mx-auto flex max-w-md flex-col items-center text-center">
					<div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
						<UserRound className="size-6" aria-hidden="true" />
					</div>
					<h2 className="text-lg font-semibold text-neutral-950">No employees yet</h2>
					<p className="mt-2 text-sm leading-6 text-neutral-600">
						Invite your first team member to start assigning appointments.
					</p>
				</div>
			</section>
		)
	}

	return (
		<section className="space-y-4">
			<div className="relative">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
				<input
					type="text"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search employees…"
					className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2 pl-10 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
				/>
			</div>

			{filteredEmployees.length > 0 ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filteredEmployees.map((employee) => (
						<EmployeeCard
							key={employee.id}
							employee={employee}
							isCurrentUser={employee.user_id === currentUserId}
						/>
					))}
				</div>
			) : (
				<div className="rounded-2xl border border-emerald-100 bg-white px-4 py-8 text-center text-sm text-neutral-600 shadow-sm shadow-emerald-950/5">
					No employees match your search.
				</div>
			)}
		</section>
	)
}