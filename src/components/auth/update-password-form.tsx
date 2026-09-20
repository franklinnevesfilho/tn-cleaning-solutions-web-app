'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { cn } from '@/lib/utils'

export type UpdatePasswordActionState = {
  status: 'editing' | 'invalid-link' | 'updated'
  sessionEstablished: boolean
  error: string | null
  fieldErrors: {
    password?: string
    confirmPassword?: string
  }
}

const initialState: UpdatePasswordActionState = {
  status: 'editing',
  sessionEstablished: false,
  error: null,
  fieldErrors: {},
}

const submitButtonClassName =
  'h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]'

const passwordInputClassName =
  'h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20'

type UpdatePasswordFormProps = {
  code: string | null
  action: (
    previousState: UpdatePasswordActionState,
    formData: FormData
  ) => Promise<UpdatePasswordActionState>
}

export const UpdatePasswordForm = ({ code, action }: UpdatePasswordFormProps) => {
  const [state, formAction] = useActionState(action, initialState)
  let content

  if (!code || state.status === 'invalid-link') {
    content = (
      <div className="space-y-4">
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-700"
          role="alert"
        >
          This password reset link is invalid, expired, or has already been used.
        </div>

        <p className="text-sm leading-6 text-neutral-600">
          Request a new link and open it in the same browser you requested it
          from.
        </p>

        <Link
          href="/forgot-password"
          className={cn(
            'inline-flex items-center justify-center',
            submitButtonClassName
          )}
        >
          Request a new link
        </Link>
      </div>
    )
  } else if (state.status === 'updated') {
    content = (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="text-sm leading-6 text-neutral-600">
          Your password has been updated and you are signed in.
        </p>

        <Link
          href="/solutions"
          className={cn(
            'inline-flex items-center justify-center',
            submitButtonClassName
          )}
        >
          Continue to the portal
        </Link>
      </div>
    )
  } else {
    content = (
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="code" value={code} />

        {state.error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
            aria-live="polite"
          >
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-neutral-700"
          >
            New password
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            autoFocus
            required
            aria-invalid={Boolean(state.fieldErrors.password)}
            aria-describedby={
              state.fieldErrors.password ? 'password-error' : undefined
            }
            className={passwordInputClassName}
            placeholder="At least 8 characters"
          />
          {state.fieldErrors.password && (
            <p
              id="password-error"
              className="text-xs text-red-600"
              role="alert"
              aria-live="polite"
            >
              {state.fieldErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-neutral-700"
          >
            Confirm new password
          </Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state.fieldErrors.confirmPassword)}
            aria-describedby={
              state.fieldErrors.confirmPassword
                ? 'confirm-password-error'
                : undefined
            }
            className={passwordInputClassName}
            placeholder="Re-enter your new password"
          />
          {state.fieldErrors.confirmPassword && (
            <p
              id="confirm-password-error"
              className="text-xs text-red-600"
              role="alert"
              aria-live="polite"
            >
              {state.fieldErrors.confirmPassword}
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
      {pending ? 'Updating...' : 'Update password'}
    </Button>
  )
}
