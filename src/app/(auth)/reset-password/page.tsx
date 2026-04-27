import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Password recovery for the portal is being finalized. If you need
              access now, contact your operations lead.
            </p>
          </div>

          <Card className="border-neutral-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
            <CardHeader className="border-b border-neutral-200/80 bg-neutral-50/70 px-6 py-6">
              <CardTitle className="text-2xl font-semibold tracking-tight text-neutral-950">
                Recovery support
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-neutral-600">
                This page is ready for the next step in the recovery flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-6">
              <p className="text-sm leading-6 text-neutral-600">
                If you were invited recently, use the invite email or ask an
                administrator to resend your access details.
              </p>

              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]"
              >
                Back to login
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}