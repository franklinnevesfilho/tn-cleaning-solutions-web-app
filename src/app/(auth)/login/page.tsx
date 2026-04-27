import { ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'

import { LoginForm, type LoginActionState } from '@/components/auth/login-form'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

const initialState: LoginActionState = {
    error: null,
    fieldErrors: {},
}

async function loginAction(
    _previousState: LoginActionState,
    formData: FormData
): Promise<LoginActionState> {
    'use server'

    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const fieldErrors: LoginActionState['fieldErrors'] = {}

    if (!email) {
        fieldErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fieldErrors.email = 'Enter a valid email address.'
    }

    if (!password) {
        fieldErrors.password = 'Password is required.'
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            ...initialState,
            fieldErrors,
        }
    }

    const client = await createClient()
    const { error } = await client.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return {
            error: 'Invalid email or password.',
            fieldErrors: {},
        }
    }

    redirect('/solutions')
}

export default function LoginPage() {
    return (
        <div className="relative flex min-h-screen items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2f3_100%)] px-4 py-4 text-neutral-950 sm:py-8">
            <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),transparent)] sm:h-48" />

            <div className="relative mx-auto w-full max-w-md">
                <div className="mb-4 text-center sm:mb-6">
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:mt-2 sm:text-3xl">
                        TN Cleaning Solutions
                    </h1>
                    <p className="mt-1 hidden text-sm leading-6 text-neutral-600 sm:mt-2 sm:block">
                        Admin and employee portal access
                    </p>    
                </div>

                <Card className="border-neutral-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                    <CardHeader className="space-y-2 border-b border-neutral-200/80 bg-neutral-50/70 px-4 py-4 sm:space-y-3 sm:px-6 sm:py-5">
                        <div className="flex items-center gap-2 text-emerald-700">
                            <ShieldCheck className="size-4" aria-hidden="true" />
                            <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                                Portal Login
                            </span>
                        </div>
                        <CardTitle className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                            Welcome back
                        </CardTitle>
                        <CardDescription className="hidden text-sm leading-6 text-neutral-600 sm:block">
                            Sign in with your TN Cleaning Solutions credentials to continue.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 py-4 sm:px-6 sm:py-6">
                        <LoginForm action={loginAction} />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}