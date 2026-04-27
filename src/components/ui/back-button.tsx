'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackButton() {
	const router = useRouter()

	return (
		<Button
			onClick={() => router.back()}
			className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
		>
			<ArrowLeft className="size-3.5" aria-hidden="true" />
			Back
		</Button>
	)
}
