'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { type ActionState, updateProfile } from '@/lib/actions/profile'

const initialState: ActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]"
    >
      {pending ? 'Saving profile...' : 'Save profile'}
    </Button>
  )
}

type ProfileFormProps = {
  fullName: string
  phone: string
}

export function ProfileForm({ fullName, phone }: ProfileFormProps) {
  const [state, formAction] = useActionState(updateProfile, initialState)
  const [fullNameValue, setFullNameValue] = useState(fullName)
  const [phoneValue, setPhoneValue] = useState(phone)

  return (
    <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5 sm:p-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
          Profile information
        </h2>
        <p className="text-sm text-neutral-600">
          Update the details we use for scheduling and operational contact.
        </p>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        {state.error ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
            aria-live="polite"
          >
            {state.error}
          </div>
        ) : null}

        {state.success ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
            role="status"
            aria-live="polite"
          >
            Profile updated successfully.
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-sm font-medium text-neutral-700">
            Full name
          </Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            value={fullNameValue}
            onChange={(e) => setFullNameValue(e.target.value)}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="Jordan Rivera"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-neutral-700">
            Phone
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="(615) 555-0100"
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-5 text-neutral-600">
          Keep this information current so dispatch and management can reach you quickly.
        </div>

        <SubmitButton />
      </form>
    </section>
  )
}