import { redirect } from 'next/navigation'

import { PasswordForm } from '@/components/profile/password-form'
import { ProfileForm } from '@/components/profile/profile-form'
import { createClient } from '@/lib/supabase/server'

function RoleBadge({ role }: { role: string }) {
    const isAdmin = role === 'admin'

    return (
        <span
            className={
                isAdmin
                    ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-700'
                    : 'inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-neutral-600'
            }
        >
            {role}
        </span>
    )
}

export default async function ProfilePage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: employee } = await supabase
        .from('employees')
        .select('full_name, phone')
        .eq('user_id', user.id)
        .maybeSingle()

    const role = (user.app_metadata?.role as string | undefined) ?? 'employee'
    const accountCreatedAt = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(user.created_at))

    return (
        <div className="mx-auto max-w-2xl space-y-8">
            <section className="relative overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_35%),linear-gradient(135deg,rgba(16,185,129,0.05),transparent_58%)]" />
                <div className="relative space-y-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-emerald-700">
                        Account center
                    </p>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
                            Profile
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
                            Keep your contact details current and update your password from one
                            focused workspace.
                        </p>
                    </div>
                </div>
            </section>

            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                            Account information
                        </h2>
                        <p className="mt-1 text-sm text-neutral-600">
                            Read-only details sourced from your authenticated session.
                        </p>
                    </div>
                    <RoleBadge role={role} />
                </div>

                <dl className="mt-6 space-y-4 border-t border-emerald-100 pt-5">
                    <div className="flex items-center justify-between gap-4">
                        <dt className="text-sm text-neutral-600">Email</dt>
                        <dd className="text-sm font-medium text-neutral-950">{user.email ?? 'Not available'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <dt className="text-sm text-neutral-600">Role</dt>
                        <dd>
                            <RoleBadge role={role} />
                        </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <dt className="text-sm text-neutral-600">Account created</dt>
                        <dd className="text-sm font-medium text-neutral-950">{accountCreatedAt}</dd>
                    </div>
                </dl>
            </section>

            <ProfileForm
                fullName={employee?.full_name ?? ''}
                phone={employee?.phone ?? ''}
            />

            <PasswordForm />
        </div>
    )
}