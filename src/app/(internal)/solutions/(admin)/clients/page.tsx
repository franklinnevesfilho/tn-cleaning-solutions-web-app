import Link from 'next/link'
import { ClientsList, type ClientWithLocationCount } from '@/components/admin/clients-list'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function ClientsPage() {
	const supabase = await createClient()

	const [{ data: clients, error: clientsError }, { data: archivedClients, error: archivedError }] =
		await Promise.all([
			supabase
				.from('clients')
				.select('id, name, email, phone, notes, is_active, is_archived, client_locations(count)')
				.eq('is_archived', false)
				.order('name', { ascending: true }),
			supabase
				.from('clients')
				.select('id, name, email, phone, notes, is_active, is_archived, client_locations(count)')
				.eq('is_archived', true)
				.order('name', { ascending: true }),
		])

	const loadError = clientsError ?? archivedError

	return (
		<div className="space-y-8">
			<section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-2">
						<h1 className="text-3xl font-bold tracking-tight text-neutral-950">Clients</h1>
						<p className="text-sm text-neutral-600">Manage your client accounts</p>
					</div>

					<Link href="/solutions/clients/new">
						<Button className="h-10 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
							New Client
						</Button>
					</Link>
				</div>
			</section>

			{loadError ? (
				<section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{loadError.message}
				</section>
			) : null}

			<ClientsList
				clients={(clients as unknown as ClientWithLocationCount[]) ?? []}
				archivedClients={(archivedClients as unknown as ClientWithLocationCount[]) ?? []}
			/>
		</div>
	)
}
