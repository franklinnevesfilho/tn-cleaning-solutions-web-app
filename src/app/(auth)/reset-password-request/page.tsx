import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordResetActionState, PasswordResetForm } from '@/components/auth/password-reset-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/dist/server/api-utils'
const initialState: PasswordResetActionState = {
  error: null,
  fieldErrors: {},
}

async function resetAction(
  _previousState: PasswordResetActionState,
  formData: FormData
): Promise<PasswordResetActionState> {
  'use server'
  
  const email = String(formData.get('email') ?? '').trim()
  console.log('Password reset request for email:', email) // Debug log
  
  const fieldErrors: PasswordResetActionState['fieldErrors'] = {}

  if (!email) {
    fieldErrors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = 'Enter a valid email address.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...initialState,
      fieldErrors,
    }
  }

  // use serverClient to send password reset email via supabase
  const client = await createClient()
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/(auth)/reset-password`,
  })

  if (error) {
    console.log('Password reset error:', error) // Debug log to check password reset error
    return {
      error: 'Failed to send password reset email. Please try again later.',
      fieldErrors: {},
    }
  }
  return {
    ...initialState,
  }

}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2f3_100%)] px-4 py-10 text-neutral-950">
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-semibold tracking-[0.22em] text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] ring-1 ring-inset ring-white/10">
              TN
            </div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-emerald-700/80">
              Account Recovery
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Reset your password
            </h1>
          </div>

          <Card className="border-neutral-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
            <CardContent className="space-y-4 px-6 py-6">
              <PasswordResetForm action={resetAction} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}