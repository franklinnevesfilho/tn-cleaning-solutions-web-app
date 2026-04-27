'use client'

import { useState } from 'react'
import { Calendar, List } from 'lucide-react'

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

  return (
    <>
      {/* Desktop view with toggle */}
      <div className="hidden md:block">
        <div className="mb-4 flex justify-end">
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
          <AppointmentsCalendar appointments={appointments} month={month} year={year} />
        ) : (
          <AppointmentsList appointments={appointments} month={month} year={year} />
        )}
      </div>

      {/* Mobile view - always list */}
      <div className="md:hidden">
        <AppointmentsList appointments={appointments} month={month} year={year} />
      </div>
    </>
  )
}
