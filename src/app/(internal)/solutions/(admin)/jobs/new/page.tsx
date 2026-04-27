import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { JobForm } from '@/components/admin/job-form'

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div className="space-y-3">
          <Link
            href="/solutions/jobs"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Jobs
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">New Job</h1>
            <p className="mt-2 text-sm text-neutral-600">Add a new service to your job catalog.</p>
          </div>
        </div>
      </section>

      <JobForm />
    </div>
  )
}
