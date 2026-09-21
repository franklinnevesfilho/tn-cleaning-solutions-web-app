import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { ClientJobPricingForm } from '@/components/admin/client-job-pricing-form'
import { createClient } from '@/lib/supabase/server'

type EditClientJobPricingPageProps = {
  params: Promise<{ id: string; pricingId: string }>
}

export default async function EditClientJobPricingPage({ params }: EditClientJobPricingPageProps) {
  const { id, pricingId } = await params
  const supabase = await createClient()

  const [{ data: client, error: clientError }, { data: pricing, error: pricingError }, { data: jobs }] =
    await Promise.all([
      supabase.from('clients').select('id, name, is_archived').eq('id', id).maybeSingle(),
      supabase
        .from('client_job_pricing')
        .select('id, job_id, hourly_rate_cents, effective_from, notes, is_archived')
        .eq('id', pricingId)
        .eq('client_id', id)
        .maybeSingle(),
      supabase
        .from('jobs')
        .select('id, name, hourly_rate_cents')
        .eq('is_archived', false)
        .order('name'),
    ])

  if (clientError || !client || client.is_archived || pricingError || !pricing || pricing.is_archived) {
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
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Edit Rate</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Correct a rate entered for {client.name}. To change the rate going forward, add a new rate instead.
            </p>
          </div>
        </div>
      </section>

      <ClientJobPricingForm
        clientId={id}
        jobs={jobs ?? []}
        pricing={{
          id: pricing.id,
          job_id: pricing.job_id,
          hourly_rate_cents: pricing.hourly_rate_cents,
          effective_from: pricing.effective_from,
          notes: pricing.notes,
        }}
      />
    </div>
  )
}
