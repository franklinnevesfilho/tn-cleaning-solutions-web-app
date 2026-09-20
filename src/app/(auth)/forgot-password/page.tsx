import {
  ForgotPasswordForm,
  type ForgotPasswordActionState,
} from '@/components/auth/forgot-password-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

async function forgotPasswordAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  'use server'

  const email = String(formData.get('email') ?? '').trim()

  if (!email) {
    return { success: false, fieldErrors: { email: 'Email is required.' } }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      fieldErrors: { email: 'Enter a valid email address.' },
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const client = await createClient()
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/update-password`,
  })

  if (error) {
    console.error('resetPasswordForEmail failed:', error.status, error.code)
  }

  return { success: true, fieldErrors: {} }
}

export default function ForgotPasswordRequestPage() {
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
                Reset your password
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-neutral-600">
                Enter your email and we&apos;ll send you a link to reset your
                password.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-6">
              <ForgotPasswordForm action={forgotPasswordAction} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
