'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

export type LoginActionState = {
  error: string | null
  fieldErrors: {
    email?: string
    password?: string
  }
}

const initialState: LoginActionState = {
  error: null,
  fieldErrors: {},
}

type LoginFormProps = {
  action: (
    previousState: LoginActionState,
    formData: FormData
  ) => Promise<LoginActionState>
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]"
    >
      {pending ? 'Signing in...' : 'Sign in'}
    </Button>
  )
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          role="alert"
          aria-live="polite"
        >
          {state.error}
        </div>
      ) : null}

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
          <p id="email-error" className="text-xs text-red-600">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="text-sm font-medium text-neutral-700"
        >
          Password
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors.password)}
          aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
          className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
          placeholder="Enter your password"
        />
        {state.fieldErrors.password && (
          <p id="password-error" className="text-xs text-red-600">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end pt-0.5">
        <Link
          href="/reset-password"
          className="text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800"
        >
          Forgot password?
        </Link>
      </div>

      <SubmitButton />

      <p className="text-center text-xs leading-relaxed text-neutral-500">
        Need access? Contact your operations lead.
      </p>
    </form>
  )
}