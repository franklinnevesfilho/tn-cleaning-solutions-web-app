'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addLocation, type LocationActionResult, updateLocation } from '@/lib/actions/clients'

type LocationFormProps = {
  clientId: string
  location?: {
    id: string
    label: string
    address: string
    notes: string | null
  }
  onSuccess?: () => void
}

const initialState: LocationActionResult = {
  success: false,
  error: '',
}

function SubmitButton({ isEditMode }: { isEditMode: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
    >
      {pending ? 'Saving...' : isEditMode ? 'Save changes' : 'Add location'}
    </Button>
  )
}

export function LocationForm({ clientId, location, onSuccess }: LocationFormProps) {
  const router = useRouter()
  const serverAction = location ? updateLocation.bind(null, location.id) : addLocation.bind(null, clientId)
  const [state, formAction, _isPending] = useActionState(serverAction, initialState)

  useEffect(() => {
    if (state.success) {
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/solutions/clients/${clientId}`)
      }
    }
  }, [state.success, onSuccess, router, clientId])

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
          <Label htmlFor="label" className="text-sm font-medium text-neutral-700">
            Label
          </Label>
          <Input
            id="label"
            name="label"
            type="text"
            required
            defaultValue={location?.label ?? 'Location'}
            aria-invalid={'fieldErrors' in state && Boolean(state.fieldErrors?.label)}
            aria-describedby={'fieldErrors' in state && state.fieldErrors?.label ? 'label-error' : undefined}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="e.g. Main Home, Lake House"
          />
          {'fieldErrors' in state && state.fieldErrors?.label ? (
            <p id="label-error" className="text-xs text-red-600">
              {state.fieldErrors.label}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address" className="text-sm font-medium text-neutral-700">
            Address
          </Label>
          <Input
            id="address"
            name="address"
            type="text"
            required
            defaultValue={location?.address ?? ''}
            aria-invalid={'fieldErrors' in state && Boolean(state.fieldErrors?.address)}
            aria-describedby={'fieldErrors' in state && state.fieldErrors?.address ? 'address-error' : undefined}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="123 Main Street, Nashville, TN"
          />
          {'fieldErrors' in state && state.fieldErrors?.address ? (
            <p id="address-error" className="text-xs text-red-600">
              {state.fieldErrors.address}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-sm font-medium text-neutral-700">
            Notes
          </Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={location?.notes ?? ''}
            className="min-h-28 rounded-xl border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="Parking details, gate code, alarm instructions, etc."
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <Link
            href={`/solutions/clients/${clientId}`}
            className="inline-flex h-10 items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <SubmitButton isEditMode={Boolean(location)} />
        </div>
      </form>
    </section>
  )
}