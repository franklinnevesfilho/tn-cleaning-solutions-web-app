import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { ClientJobPricingForm } from '@/components/admin/client-job-pricing-form'
import { createClient } from '@/lib/supabase/server'

type NewClientJobPricingPageProps = {
  params: Promise<{ id: string }>
}

export default async function NewClientJobPricingPage({ params }: NewClientJobPricingPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client, error }, { data: jobs }] = await Promise.all([
    supabase.from('clients').select('id, name, is_archived').eq('id', id).maybeSingle(),
    supabase
      .from('jobs')
      .select('id, name, hourly_rate_cents')
      .eq('is_archived', false)
      .order('name'),
  ])

  if (error || !client || client.is_archived) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div className="space-y-3">
          <Link
            href={`/solutions/clients/${id}/pricing`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Custom Pricing
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Add Rate</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Set a custom hourly rate for {client.name} on a job.
            </p>
          </div>
        </div>
      </section>

      <ClientJobPricingForm clientId={id} jobs={jobs ?? []} />
    </div>
  )
}
