import Link from 'next/link'
import { EmployeesList } from '@/components/admin/employees-list'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function EmployeesPage() {
	const supabase = await createClient()
	const { data: { user } } = await supabase.auth.getUser()
	const currentUserId = user?.id ?? null
	const { data: employees, error } = await supabase
		.from('employees')
		.select('id, user_id, full_name, phone, is_active, is_archived')
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

			<EmployeesList employees={sortedEmployees ?? []} currentUserId={currentUserId} />
		</div>
	)
}
