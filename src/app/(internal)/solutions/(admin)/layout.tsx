import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
	children,
}: {
	children: ReactNode
}) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	const role = user?.app_metadata?.role

	if (!user) {
		redirect('/login')
	}

	if (role !== 'admin') {
		redirect('/solutions/schedule')
	}

	return <>{children}</>
}
