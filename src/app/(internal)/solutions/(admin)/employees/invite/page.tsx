import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { InviteEmployeeForm } from '@/components/admin/invite-employee-form'

export default function InviteEmployeePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
        <div className="space-y-3">
          <Link
            href="/solutions/employees"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Employees
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Invite Employee</h1>
            <p className="mt-2 text-sm text-neutral-600">Send a secure invite to onboard a new team member.</p>
          </div>
        </div>
      </section>

      <InviteEmployeeForm />
    </div>
  )
}