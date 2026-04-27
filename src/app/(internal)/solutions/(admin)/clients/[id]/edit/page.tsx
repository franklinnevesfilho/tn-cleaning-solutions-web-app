import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { ClientForm } from '@/components/admin/client-form'
import { createClient } from '@/lib/supabase/server'

type EditClientPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, email, phone, notes, is_active, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (error || !client || client.is_archived) {
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
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Edit Client</h1>
            <p className="mt-2 text-sm text-neutral-600">Update client information and status.</p>
          </div>
        </div>
      </section>

      <ClientForm
        client={{
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          notes: client.notes,
          is_active: client.is_active,
        }}
      />
    </div>
  )
}