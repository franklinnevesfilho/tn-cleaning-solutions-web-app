'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Clock, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { clockIn, clockOut } from '@/lib/actions/attendance'
import { cn } from '@/lib/utils'

type ClockStatus = 'clocked_in' | 'clocked_out' | 'not_started'
type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

type ClockActionsProps = {
	appointmentEmployeeId: string
	clockStatus: ClockStatus
	appointmentStatus: AppointmentStatus
}

export function ClockActions({ appointmentEmployeeId, clockStatus, appointmentStatus }: ClockActionsProps) {
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const [error, setError] = useState<string | null>(null)

	const isDisabled = appointmentStatus === 'completed' || appointmentStatus === 'cancelled'

	const handleClockIn = () => {
		setError(null)
		startTransition(async () => {
			const result = await clockIn(appointmentEmployeeId)
			if (result.error) {
				setError(result.error)
				return
			}

			router.refresh()
		})
	}

	const handleClockOut = () => {
		setError(null)
		startTransition(async () => {
			const result = await clockOut(appointmentEmployeeId)
			if (result.error) {
				setError(result.error)
				return
			}

			router.refresh()
		})
	}

	return (
		<div className="space-y-3">
			{error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

			<div className="flex gap-2">
				{clockStatus === 'not_started' ? (
					<Button
						onClick={handleClockIn}
						disabled={isPending || isDisabled}
						className={cn('flex-1 bg-emerald-600 text-white hover:bg-emerald-700', isDisabled && 'cursor-not-allowed opacity-50')}
					>
						{isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Clock className="mr-2 size-4" aria-hidden="true" />}
						{isPending ? 'Clocking in...' : 'Clock In'}
					</Button>
				) : null}

				{clockStatus === 'clocked_in' ? (
					<Button
						onClick={handleClockOut}
						disabled={isPending || isDisabled}
						className={cn('flex-1 bg-neutral-900 text-white hover:bg-neutral-800', isDisabled && 'cursor-not-allowed opacity-50')}
					>
						{isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <CheckCircle className="mr-2 size-4" aria-hidden="true" />}
						{isPending ? 'Clocking out...' : 'Clock Out'}
					</Button>
				) : null}

				{clockStatus === 'clocked_out' ? (
					<div className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-600">
						<CheckCircle className="mr-2 inline-block size-4 text-neutral-500" aria-hidden="true" />
						Work completed
					</div>
				) : null}
			</div>

			{isDisabled ? <p className="text-center text-xs text-neutral-500">This appointment is {appointmentStatus}. Clock actions are disabled.</p> : null}
		</div>
	)
}