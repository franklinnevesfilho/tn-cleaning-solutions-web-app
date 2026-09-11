'use client'

import { useMemo, useState } from 'react'
import { Calendar, List } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { AppointmentsCalendar } from '@/components/admin/appointments-calendar'
import { AppointmentsList } from '@/components/admin/appointments-list'
import type { AppointmentSummary } from '@/components/admin/appointments-types'
import { cn } from '@/lib/utils'

type AppointmentsViewToggleProps = {
  appointments: AppointmentSummary[]
  month: number
  year: number
}

export function AppointmentsViewToggle({ appointments, month, year }: AppointmentsViewToggleProps) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const showCancelled = searchParams.get('showCancelled') === 'true'

  const visibleAppointments = useMemo(() => {
    if (showCancelled) {
      return appointments
    }

    return appointments.filter((appointment) => appointment.status !== 'cancelled')
  }, [appointments, showCancelled])

  const toggleShowCancelled = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (showCancelled) {
      params.delete('showCancelled')
    } else {
      params.set('showCancelled', 'true')
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <>
      <div className="hidden md:block">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <ShowCancelledToggle showCancelled={showCancelled} onToggle={toggleShowCancelled} />

          <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('calendar')}
              className={cn(
                'h-8 rounded-lg px-3 text-xs font-medium transition-colors',
                view === 'calendar'
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <Calendar className="mr-1.5 size-3.5" />
              Calendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('list')}
              className={cn(
                'h-8 rounded-lg px-3 text-xs font-medium transition-colors',
                view === 'list'
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <List className="mr-1.5 size-3.5" />
              List
            </Button>
          </div>
        </div>

        {view === 'calendar' ? (
          <AppointmentsCalendar appointments={visibleAppointments} month={month} year={year} />
        ) : (
          <AppointmentsList appointments={visibleAppointments} month={month} year={year} />
        )}
      </div>

      <div className="md:hidden">
        <div className="mb-3 flex justify-end">
          <ShowCancelledToggle showCancelled={showCancelled} onToggle={toggleShowCancelled} />
        </div>

        <AppointmentsList appointments={visibleAppointments} month={month} year={year} />
      </div>
    </>
  )
}

type ShowCancelledToggleProps = {
  showCancelled: boolean
  onToggle: () => void
}

const ShowCancelledToggle = ({ showCancelled, onToggle }: ShowCancelledToggleProps) => (
  <Button
    type="button"
    variant="outline"
    aria-pressed={showCancelled}
    className={cn(
      'h-9 rounded-full',
      showCancelled && 'border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    )}
    onClick={onToggle}
  >
    {showCancelled ? 'Hide cancelled' : 'Show cancelled'}
  </Button>
)
