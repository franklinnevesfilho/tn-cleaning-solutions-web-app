'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BriefcaseBusiness, Pencil, RotateCcw, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { archiveJob, restoreJob } from '@/lib/actions/jobs'

export type JobRow = {
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

export default function JobsList({ jobs, archivedJobs }: { jobs?: JobRow[]; archivedJobs?: JobRow[] }) {
    const [query, setQuery] = useState('')
    const normalizedQuery = query.trim().toLowerCase()
    const filteredJobs = (jobs ?? []).filter((job) => {
		if (!normalizedQuery) {
			return true
		}

		return job.name.toLowerCase().includes(normalizedQuery) || job.description?.toLowerCase().includes(normalizedQuery)
	})

	return (
		<>
			{(jobs?.length ?? 0) > 0 ? (
				<section className="space-y-4">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
						<input
							type="text"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search jobs…"
							className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2 pl-10 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
						/>
					</div>

					{filteredJobs.length > 0 ? (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{filteredJobs.map((job) => (
								<JobCard key={job.id} job={job} />
							))}
						</div>
					) : (
						<div className="rounded-2xl border border-emerald-100 bg-white px-4 py-8 text-center text-sm text-neutral-600 shadow-sm shadow-emerald-950/5">
							No jobs match your search.
						</div>
					)}
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
		</>
	)
}