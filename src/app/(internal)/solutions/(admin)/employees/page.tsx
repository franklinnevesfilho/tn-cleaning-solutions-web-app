import Link from 'next/link'
import { Clock, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { activateEmployee, deactivateEmployee } from '@/lib/actions/employees'
import { createClient } from '@/lib/supabase/server'

type EmployeeRow = {
	id: string
	full_name: string
	phone: string | null
	is_active: boolean
	is_archived: boolean
}

function EmployeeCard({ employee }: { employee: EmployeeRow }) {
	async function handleStatusChange(formData: FormData) {
		'use server'

		const employeeId = String(formData.get('employeeId') ?? '')
		const isActive = String(formData.get('isActive') ?? '') === 'true'

		if (!employeeId) {
			return
		}

		if (isActive) {
			await deactivateEmployee(employeeId)
			return
		}

		await activateEmployee(employeeId)
	}

	return (
		<Card className="rounded-2xl border border-neutral-200 bg-white py-0 shadow-sm shadow-emerald-950/5">
			<CardHeader className="gap-2 border-b border-neutral-100 px-5 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle className="truncate text-base font-semibold text-neutral-950">
							{employee.full_name}
						</CardTitle>
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

				<form action={handleStatusChange}>
					<input type="hidden" name="employeeId" value={employee.id} />
					<input type="hidden" name="isActive" value={employee.is_active ? 'true' : 'false'} />
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

export default async function EmployeesPage() {
	const supabase = await createClient()
	const { data: employees, error } = await supabase
		.from('employees')
		.select('id, full_name, phone, is_active, is_archived')
		.eq('is_archived', false)
		.order('full_name', { ascending: true })

    
        // sort employees so that inactive ones are at the end, but keep the order by name within each group
    const sortedEmployees = employees?.sort((a, b) => {
      if (a.is_active === b.is_active) {
        return a.full_name.localeCompare(b.full_name);
      }
      return a.is_active ? -1 : 1;
    });

	return (
		<div className="space-y-8">
			<section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-2">
						<h1 className="text-3xl font-bold tracking-tight text-neutral-950">Employees</h1>
						<p className="text-sm text-neutral-600">Manage your team</p>
					</div>

					<Link href="/solutions/employees/invite">
						<Button className="h-10 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
							Invite Employee
						</Button>
					</Link>
				</div>
			</section>

			{error ? (
				<section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error.message}
				</section>
			) : null}

			{(sortedEmployees?.length ?? 0) > 0 ? (
				<section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{(sortedEmployees ?? []).map((employee) => (
						<EmployeeCard key={employee.id} employee={employee as EmployeeRow} />
					))}
				</section>
			) : (
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
			)}
		</div>
	)
}
