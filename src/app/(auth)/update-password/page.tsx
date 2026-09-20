import {
  UpdatePasswordForm,
  type UpdatePasswordActionState,
} from '@/components/auth/update-password-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type UpdatePasswordPageProps = {
  searchParams: Promise<{ code?: string | string[] }>
}

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const rawCode = (await searchParams).code
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode) ?? null

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
          </div>

          <Card className="border-neutral-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
            <CardHeader className="border-b border-neutral-200/80 bg-neutral-50/70 px-6 py-6">
              <CardTitle className="text-2xl font-semibold tracking-tight text-neutral-950">
                Set a new password
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-neutral-600">
                Choose a new password for your TN Cleaning Solutions account.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-6">
              <UpdatePasswordForm code={code} action={updatePasswordAction} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

async function updatePasswordAction(
  previousState: UpdatePasswordActionState,
  formData: FormData
): Promise<UpdatePasswordActionState> {
  'use server'

  const code = String(formData.get('code') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  const fieldErrors: UpdatePasswordActionState['fieldErrors'] = {}

  if (password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters.'
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match.'
  }

  let state: UpdatePasswordActionState

  if (Object.keys(fieldErrors).length > 0) {
    state = {
      status: 'editing',
      sessionEstablished: previousState.sessionEstablished,
      error: null,
      fieldErrors,
    }
  } else {
    const client = await createClient()
    const exchangeError = previousState.sessionEstablished
      ? null
      : (await client.auth.exchangeCodeForSession(code)).error

    if (exchangeError) {
      state = {
        status: 'invalid-link',
        sessionEstablished: false,
        error: null,
        fieldErrors: {},
      }
    } else {
      const { error: updateError } = await client.auth.updateUser({ password })

      if (updateError) {
        state = {
          status: 'editing',
          sessionEstablished: true,
          error: updateError.message,
          fieldErrors: {},
        }
      } else {
        state = {
          status: 'updated',
          sessionEstablished: true,
          error: null,
          fieldErrors: {},
        }
      }
    }
  }

  return state
}
