import Link from 'next/link'
import { BriefcaseBusiness, Pencil, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { archiveJob, restoreJob } from '@/lib/actions/jobs'
import { createClient } from '@/lib/supabase/server'

type JobRow = {
	id: string
	name: string
	description: string | null
	base_price_cents: number
	estimated_duration_minutes: number | null
	is_archived: boolean
}

const usdFormatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
})

function formatPrice(cents: number) {
	return usdFormatter.format(cents / 100)
}

function formatDuration(totalMinutes: number | null) {
	if (!totalMinutes) {
		return 'No estimate'
	}

	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60

	if (hours > 0 && minutes > 0) {
		return `${hours}h ${minutes}m`
	}

	if (hours > 0) {
		return `${hours}h`
	}

	return `${minutes}m`
}

function shortDescription(description: string | null) {
	if (!description) {
		return 'No description provided.'
	}

	if (description.length <= 120) {
		return description
	}

	return `${description.slice(0, 117)}...`
}

function JobCard({ job, archived }: { job: JobRow; archived?: boolean }) {
	async function handleJobStateChange(formData: FormData) {
		'use server'

		const id = String(formData.get('id') ?? '')
		if (!id) {
			return
		}

		if (archived) {
			await restoreJob(id)
			return
		}

		await archiveJob(id)
	}

	return (
		<Card className="rounded-2xl border border-neutral-200 bg-white py-0 shadow-sm shadow-emerald-950/5">
			<CardHeader className="gap-2 border-b border-neutral-100 px-5 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle className="truncate text-base font-semibold text-neutral-950">{job.name}</CardTitle>
						<p className="mt-1 text-xs text-neutral-500">{formatDuration(job.estimated_duration_minutes)}</p>
					</div>
					<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
						{formatPrice(job.base_price_cents)}
					</span>
				</div>
			</CardHeader>

			<CardContent className="px-5 py-4">
				<p className="min-h-11 text-sm leading-6 text-neutral-600">{shortDescription(job.description)}</p>
			</CardContent>

			<CardFooter className="justify-between border-t border-neutral-100 px-5 py-3">
				{!archived ? (
					<Link
						href={`/solutions/jobs/${job.id}/edit`}
						className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
					>
						<Pencil className="size-3.5" aria-hidden="true" />
						Edit
					</Link>
				) : (
					<span className="text-xs text-neutral-500">Archived job</span>
				)}

				<form action={handleJobStateChange}>
					<input type="hidden" name="id" value={job.id} />
					<Button
						type="submit"
						variant="outline"
						className={`
							cursor-pointer
                            ${archived
								? 'h-8 rounded-full border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100'
								: 'h-8 rounded-full border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-red-500/80'}
						`}
					>
						{archived ? (
							<>
								<RotateCcw className="size-3.5" aria-hidden="true" />
								Restore
							</>
						) : (
							'Archive'
						)}
					</Button>
				</form>
			</CardFooter>
		</Card>
	)
}

export default async function JobsPage() {
	const supabase = await createClient()

	const [{ data: jobs, error: jobsError }, { data: archivedJobs, error: archivedError }] =
		await Promise.all([
			supabase
				.from('jobs')
				.select('id, name, description, base_price_cents, estimated_duration_minutes, is_archived')
				.eq('is_archived', false)
				.order('name', { ascending: true }),
			supabase
				.from('jobs')
				.select('id, name, description, base_price_cents, estimated_duration_minutes, is_archived')
				.eq('is_archived', true)
				.order('name', { ascending: true }),
		])

	const loadError = jobsError ?? archivedError

	return (
		<div className="space-y-8">
			<section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-2">
						<h1 className="text-3xl font-bold tracking-tight text-neutral-950">Jobs</h1>
						<p className="text-sm text-neutral-600">Manage your service offerings</p>
					</div>

					<Link href="/solutions/jobs/new">
						<Button className="h-10 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
							New Job
						</Button>
					</Link>
				</div>
			</section>

			{loadError ? (
				<section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{loadError.message}
				</section>
			) : null}

			{(jobs?.length ?? 0) > 0 ? (
				<section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{(jobs ?? []).map((job) => (
						<JobCard key={job.id} job={job as JobRow} />
					))}
				</section>
			) : (
				<section className="rounded-2xl border border-emerald-100 bg-white p-10 shadow-sm shadow-emerald-950/5">
					<div className="mx-auto flex max-w-md flex-col items-center text-center">
						<div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
							<BriefcaseBusiness className="size-6" aria-hidden="true" />
						</div>
						<h2 className="text-lg font-semibold text-neutral-950">No jobs yet</h2>
						<p className="mt-2 text-sm leading-6 text-neutral-600">
							Create your first service offering to start assigning jobs to appointments.
						</p>
					</div>
				</section>
			)}

			{(archivedJobs?.length ?? 0) > 0 ? (
				<section>
					<details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-emerald-950/5">
						<summary className="cursor-pointer list-none">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-base font-semibold text-neutral-950">Archived Jobs</h2>
								<span className="rounded-full border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600">
									{archivedJobs?.length}
								</span>
							</div>
						</summary>
						<div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{(archivedJobs ?? []).map((job) => (
								<JobCard key={job.id} job={job as JobRow} archived />
							))}
						</div>
					</details>
				</section>
			) : null}
		</div>
	)
}
