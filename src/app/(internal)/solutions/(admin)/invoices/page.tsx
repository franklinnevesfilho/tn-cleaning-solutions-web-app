import Link from 'next/link'
import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { archiveInvoice, restoreInvoice } from '@/lib/actions/invoices'
import { createClient } from '@/lib/supabase/server'

type InvoiceListRow = {
	id: string
	status: 'draft' | 'issued' | 'paid' | 'void'
	effective_status: 'draft' | 'issued' | 'paid' | 'void' | 'overdue'
	issued_date: string | null
	due_date: string | null
	total_cents: number
	notes: string | null
	is_archived: boolean
	clients: { name: string } | { name: string }[] | null
}

function formatCurrency(cents: number) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
	}).format(cents / 100)
}

function getClientName(clients: InvoiceListRow['clients']) {
	if (!clients) {
		return 'Unknown client'
	}

	if (Array.isArray(clients)) {
		return clients[0]?.name ?? 'Unknown client'
	}

	return clients.name
}

function formatDateValue(value: string | null) {
	if (!value) {
		return 'Not set'
	}

	const [year, month, day] = value.split('-').map(Number)
	const localDate = new Date(year, month - 1, day)
	return localDate.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

function statusBadgeClasses(status: InvoiceListRow['effective_status']) {
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

function invoiceRef(id: string) {
	return `INV-${id.slice(0, 8).toUpperCase()}`
}

function InvoiceCard({ invoice, archived = false }: { invoice: InvoiceListRow; archived?: boolean }) {
	async function handleArchiveToggle(formData: FormData) {
		'use server'

		const id = String(formData.get('id') ?? '')
		if (!id) {
			return
		}

		if (archived) {
			await restoreInvoice(id)
			return
		}

		await archiveInvoice(id)
	}

	const canArchive =
		archived || invoice.effective_status === 'draft' || invoice.effective_status === 'paid' || invoice.effective_status === 'void'

	return (
		<article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-emerald-950/5">
			<div className="space-y-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<p className="truncate text-sm font-semibold text-neutral-950">{getClientName(invoice.clients)}</p>
						<p className="text-xs text-neutral-500">{invoiceRef(invoice.id)}</p>
					</div>
					<span
						className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClasses(invoice.effective_status)}`}
					>
						{invoice.effective_status}
					</span>
				</div>

				<div>
					<p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total</p>
					<p className="mt-1 text-xl font-bold text-neutral-950">{formatCurrency(invoice.total_cents)}</p>
				</div>

				<div className="grid grid-cols-2 gap-3 text-xs text-neutral-600">
					<div>
						<p className="font-medium text-neutral-500">Issued</p>
						<p>{formatDateValue(invoice.issued_date)}</p>
					</div>
					<div>
						<p className="font-medium text-neutral-500">Due</p>
						<p>{formatDateValue(invoice.due_date)}</p>
					</div>
				</div>

				<div className="flex items-center justify-between border-t border-neutral-100 pt-3">
					<Link
						href={`/solutions/invoices/${invoice.id}`}
						className="inline-flex h-9 items-center rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
					>
						View
					</Link>

					{canArchive ? (
						<form action={handleArchiveToggle}>
							<input type="hidden" name="id" value={invoice.id} />
							<Button
								type="submit"
								variant="outline"
								className={
									archived
										? 'h-9 rounded-full border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100'
										: 'h-9 rounded-full border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50'
								}
							>
								{archived ? 'Restore' : 'Archive'}
							</Button>
						</form>
					) : null}
				</div>
			</div>
		</article>
	)
}

export default async function InvoicesPage() {
	const supabase = await createClient()

	const [{ data: activeRows, error: activeError }, { data: archivedRows, error: archivedError }] =
		await Promise.all([
			supabase
				.from('invoices_with_status')
				.select('id, client_id, status, effective_status, issued_date, due_date, total_cents, notes, is_archived, clients!inner(name), created_at')
				.eq('is_archived', false)
				.order('created_at', { ascending: false }),
			supabase
				.from('invoices_with_status')
				.select('id, client_id, status, effective_status, issued_date, due_date, total_cents, notes, is_archived, clients!inner(name), created_at')
				.eq('is_archived', true)
				.order('created_at', { ascending: false }),
		])

	const loadError = activeError ?? archivedError
	const activeInvoices = (activeRows ?? []) as unknown as InvoiceListRow[]
	const archivedInvoices = (archivedRows ?? []) as unknown as InvoiceListRow[]

	return (
		<div className="space-y-8">
			<section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-neutral-950">Invoices</h1>
						<p className="mt-2 text-sm text-neutral-600">Track draft, issued, paid, void, and overdue invoices.</p>
					</div>

					<Link href="/solutions/invoices/new">
						<Button className="h-10 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
							Create Invoice
						</Button>
					</Link>
				</div>
			</section>

			{loadError ? (
				<section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{loadError.message}
				</section>
			) : null}

			{activeInvoices.length > 0 ? (
				<section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{activeInvoices.map((invoice) => (
						<InvoiceCard key={invoice.id} invoice={invoice} />
					))}
				</section>
			) : (
				<section className="rounded-2xl border border-emerald-100 bg-white p-10 shadow-sm shadow-emerald-950/5">
					<div className="mx-auto flex max-w-md flex-col items-center text-center">
						<div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
							<FileText className="size-6" aria-hidden="true" />
						</div>
						<h2 className="text-lg font-semibold text-neutral-950">No invoices yet</h2>
						<p className="mt-2 text-sm leading-6 text-neutral-600">
							Create your first invoice to bill completed appointments.
						</p>
					</div>
				</section>
			)}

			{archivedInvoices.length > 0 ? (
				<section>
					<details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-emerald-950/5">
						<summary className="cursor-pointer list-none">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-base font-semibold text-neutral-950">Archived Invoices</h2>
								<span className="rounded-full border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600">
									{archivedInvoices.length}
								</span>
							</div>
						</summary>

						<div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{archivedInvoices.map((invoice) => (
								<InvoiceCard key={invoice.id} invoice={invoice} archived />
							))}
						</div>
					</details>
				</section>
			) : null}
		</div>
	)
}
