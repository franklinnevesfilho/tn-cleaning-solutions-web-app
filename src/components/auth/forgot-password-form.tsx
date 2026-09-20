'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ForgotPasswordActionState = {
  success: boolean
  fieldErrors: {
    email?: string
  }
}

const initialState: ForgotPasswordActionState = {
  success: false,
  fieldErrors: {},
}

const submitButtonClassName =
  'h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]'

type ForgotPasswordFormProps = {
  action: (
    previousState: ForgotPasswordActionState,
    formData: FormData
  ) => Promise<ForgotPasswordActionState>
}

export const ForgotPasswordForm = ({ action }: ForgotPasswordFormProps) => {
  const [state, formAction] = useActionState(action, initialState)
  let content

  if (state.success) {
    content = (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="text-sm leading-6 text-neutral-600">
          If an account exists for that email address, a password reset link
          is on its way.
        </p>
        <Link
          href="/login"
          className={`inline-flex items-center justify-center ${submitButtonClassName}`}
        >
          Back to login
        </Link>
      </div>
    )
  } else {
    content = (
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-neutral-700">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            aria-invalid={Boolean(state.fieldErrors.email)}
            aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
            className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
            placeholder="admin@tncleaningsolutions.com"
          />
          {state.fieldErrors.email && (
            <p
              id="email-error"
              className="text-xs text-red-600"
              role="alert"
              aria-live="polite"
            >
              {state.fieldErrors.email}
            </p>
          )}
        </div>

        <SubmitButton />

        <p className="text-center text-sm text-neutral-500">
          <Link
            href="/login"
            className="font-medium text-emerald-700 transition-colors hover:text-emerald-800"
          >
            Back to login
          </Link>
        </p>
      </form>
    )
  }

  return content
}

const SubmitButton = () => {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className={submitButtonClassName}>
      {pending ? 'Sending...' : 'Send reset link'}
    </Button>
  )
}
