'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'

import { type ActionState, updatePassword } from '@/lib/actions/profile'

const initialState: ActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]"
    >
      {pending ? 'Updating password...' : 'Change password'}
    </Button>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
    }
  }, [state.success])

  return (
    <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm shadow-emerald-950/5 sm:p-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
          Change password
        </h2>
        <p className="text-sm text-neutral-600">
          Choose a new password with at least 8 characters.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="mt-6 space-y-4">
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
            Password updated successfully.
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="new_password" className="text-sm font-medium text-neutral-700">
            New password
          </Label>
          <PasswordInput
            id="new_password"
            name="new_password"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="At least 8 characters"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-sm font-medium text-neutral-700">
            Confirm password
          </Label>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            autoComplete="new-password"
            required
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="Re-enter the new password"
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-5 text-neutral-600">
          Use a password you do not reuse elsewhere. The change takes effect immediately.
        </div>

        <SubmitButton />
      </form>
    </section>
  )
}