import { AdminSidebar } from '@/components/admin/sidebar-nav'
import { EmployeeNav } from '@/components/employee/employee-nav'
import { createClient } from '@/lib/supabase/server'

import signOutAction from './signOutAction'

export default async function SolutionsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const role = user?.app_metadata?.role

    if (role === 'admin') {
        return (
            <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-950 lg:flex-row">
                <AdminSidebar onLogout={signOutAction} />
                <main className="min-w-0 flex-1 overflow-auto">
                    <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
                        {children}
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f5f7f5_100%)] text-neutral-950">
            <EmployeeNav />
            <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
            </main>
        </div>
    )
}