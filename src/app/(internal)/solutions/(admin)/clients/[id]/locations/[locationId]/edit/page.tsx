import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { LocationForm } from '@/components/admin/location-form'
import { createClient } from '@/lib/supabase/server'

type EditLocationPageProps = {
  params: Promise<{ id: string; locationId: string }>
}

export default async function EditLocationPage({ params }: EditLocationPageProps) {
  const { id, locationId } = await params
  const supabase = await createClient()

  const { data: location, error } = await supabase
    .from('client_locations')
    .select('id, client_id, label, address, notes, is_archived')
    .eq('id', locationId)
    .eq('client_id', id)
    .maybeSingle()

  if (error || !location || location.is_archived) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div className="space-y-3">
          <Link
            href={`/solutions/clients/${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Client
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Edit Location</h1>
            <p className="mt-2 text-sm text-neutral-600">Update this service location for the client.</p>
          </div>
        </div>
      </section>

      <LocationForm
        clientId={id}
        location={{
          id: location.id,
          label: location.label,
          address: location.address,
          notes: location.notes,
        }}
      />
    </div>
  )
}