'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateEmployee, type EmployeeActionResult } from '@/lib/actions/employees'

type EmployeeEditFormProps = {
  employee: {
    id: string
    full_name: string
    phone: string | null
    is_active: boolean
  }
}

const initialState: EmployeeActionResult = {
  success: false,
  error: '',
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
    >
      {pending ? 'Saving...' : 'Save changes'}
    </Button>
  )
}

export function EmployeeEditForm({ employee }: EmployeeEditFormProps) {
  const [state, formAction] = useActionState(updateEmployee.bind(null, employee.id), initialState)

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5">
      <form action={formAction} className="space-y-5">
        {'error' in state && state.error ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
            aria-live="polite"
          >
            {state.error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-sm font-medium text-neutral-700">
            Full Name
          </Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            required
            defaultValue={employee.full_name}
            aria-invalid={'fieldErrors' in state && Boolean(state.fieldErrors?.full_name)}
            aria-describedby={
              'fieldErrors' in state && state.fieldErrors?.full_name ? 'full-name-error' : undefined
            }
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="Alex Johnson"
          />
          {'fieldErrors' in state && state.fieldErrors?.full_name ? (
            <p id="full-name-error" className="text-xs text-red-600">
              {state.fieldErrors.full_name}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-neutral-700">
            Phone
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={employee.phone ?? ''}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="(615) 555-0100"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={employee.is_active}
            className="size-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-neutral-700">Employee is active</span>
        </label>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <Link
            href={`/solutions/employees/${employee.id}`}
            className="inline-flex h-10 items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </form>
    </section>
  )
}