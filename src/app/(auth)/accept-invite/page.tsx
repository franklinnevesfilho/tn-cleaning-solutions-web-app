'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
	ArrowRight,
	CheckCircle2,
	KeyRound,
	Loader2,
	ShieldCheck,
	UserRound,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/browser'

import { completeProfile, type CompleteProfileState } from './actions'
import { PasswordInput } from '@/components/ui/password-input'

type Step = 'verifying' | 'set-password' | 'complete-profile' | 'error'

const profileInitialState: CompleteProfileState = {
	error: null,
}

function StepBadge({
	active,
	done,
	number,
	label,
}: {
	active: boolean
	done: boolean
	number: number
	label: string
}) {
	return (
		<div
			className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${
				done
					? 'border-emerald-200 bg-emerald-50 text-emerald-900'
					: active
						? 'border-neutral-300 bg-white text-neutral-950 shadow-sm'
						: 'border-neutral-200 bg-neutral-50 text-neutral-500'
			}`}
		>
			<div
				className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
					done
						? 'bg-emerald-600 text-white'
						: active
							? 'bg-neutral-950 text-white'
							: 'bg-neutral-200 text-neutral-600'
				}`}
			>
				{done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : number}
			</div>
			<span className="text-sm font-medium">{label}</span>
		</div>
	)
}

function PendingButton({
	pending,
	label,
	pendingLabel,
}: {
	pending: boolean
	label: string
	pendingLabel: string
}) {
	return (
		<Button
			type="submit"
			disabled={pending}
			className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]"
		>
			{pending ? pendingLabel : label}
		</Button>
	)
}

function SetPasswordForm({
	onSuccess,
}: {
	onSuccess: () => void
}) {
	const supabase = useMemo(() => createClient(), [])
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	const passwordLength = password.length

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)

		if (passwordLength < 8) {
			setError('Password must be at least 8 characters long.')
			return
		}

		if (password !== confirmPassword) {
			setError('Passwords do not match.')
			return
		}

		setPending(true)

		const { error: updateError } = await supabase.auth.updateUser({
			password,
		})

		setPending(false)

		if (updateError) {
			setError(updateError.message || 'Unable to update your password.')
			return
		}

		onSuccess()
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-1.5">
				<Label htmlFor="password" className="text-sm font-medium text-neutral-700">
					Create password
				</Label>
				<PasswordInput
					id="password"
					name="password"
					autoComplete="new-password"
					required
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
					placeholder="At least 8 characters"
				/>
			</div>

			<div className="space-y-1.5">
				<Label
					htmlFor="confirmPassword"
					className="text-sm font-medium text-neutral-700"
				>
					Confirm password
				</Label>
				<PasswordInput
					id="confirmPassword"
					name="confirmPassword"
					autoComplete="new-password"
					required
					value={confirmPassword}
					onChange={(event) => setConfirmPassword(event.target.value)}
					className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
					placeholder="Re-enter your password"
				/>
			</div>

			{error ? (
				<div
					className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
					role="alert"
					aria-live="polite"
				>
					{error}
				</div>
			) : null}

			<div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-5 text-neutral-600">
				Use a password you do not use anywhere else. This account will unlock the
				employee schedule after your profile is completed.
			</div>

			<Button
				type="submit"
				disabled={pending}
				className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 hover:shadow-[0_16px_34px_rgba(5,150,105,0.22)]"
			>
				{pending ? (
					<span className="inline-flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						Saving password...
					</span>
				) : (
					'Continue'
				)}
			</Button>
		</form>
	)
}

function ProfileSubmitButton() {
	const { pending } = useFormStatus()

	return (
		<PendingButton
			pending={pending}
			label="Finish setup"
			pendingLabel="Saving profile..."
		/>
	)
}

function CompleteProfileForm() {
	const [state, formAction] = useActionState(completeProfile, profileInitialState)

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
				<Label htmlFor="full_name" className="text-sm font-medium text-neutral-700">
					Full name
				</Label>
				<Input
					id="full_name"
					name="full_name"
					type="text"
					autoComplete="name"
					required
					className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
					placeholder="Jordan Rivera"
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="phone" className="text-sm font-medium text-neutral-700">
					Phone number
				</Label>
				<Input
					id="phone"
					name="phone"
					type="tel"
					autoComplete="tel"
					required
					className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
					placeholder="(555) 123-4567"
				/>
			</div>

			<div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-5 text-neutral-600">
				We use this for operational contact and schedule coordination only.
			</div>

			<ProfileSubmitButton />
		</form>
	)
}

export default function AcceptInvitePage() {
	const searchParams = useSearchParams()
	const supabase = useMemo(() => createClient(), [])
	const [step, setStep] = useState<Step>('verifying')
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		const verifyInvite = async () => {
			const { data: { user: existingUser } } = await supabase.auth.getUser()
			if (existingUser) {
				if (!cancelled) setStep('set-password')
				return
			}

			// First check URL hash for implicit flow tokens (local Supabase dev)
			const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
			const hashParams = new URLSearchParams(hash)
			const hashAccessToken = hashParams.get('access_token')
			const hashRefreshToken = hashParams.get('refresh_token')
			const hashType = hashParams.get('type')

			if (hashAccessToken && hashRefreshToken && hashType === 'invite') {
				// Implicit flow: session tokens already in hash — set the session directly
				const { error: sessionError } = await supabase.auth.setSession({
					access_token: hashAccessToken,
					refresh_token: hashRefreshToken,
				})

				if (cancelled) return

				if (sessionError) {
					setError(sessionError.message || 'This invite link is invalid or expired.')
					setStep('error')
					return
				}

				// Clean hash from URL without reloading
				if (typeof window !== 'undefined') {
					window.history.replaceState(null, '', window.location.pathname)
				}

				setStep('set-password')
				return
			}

			// Fallback: PKCE flow — token_hash in query param
			const tokenHash = searchParams.get('token_hash')

			if (!tokenHash) {
				setError('Invalid invite link.')
				setStep('error')
				return
			}

			const { error: verifyError } = await supabase.auth.verifyOtp({
				token_hash: tokenHash,
				type: 'invite',
			})

			if (cancelled) {
				return
			}

			if (verifyError) {
				setError(verifyError.message || 'This invite link is invalid or expired.')
				setStep('error')
				return
			}

			setStep('set-password')
		}

		verifyInvite()

		return () => {
			cancelled = true
		}
	}, [searchParams, supabase])

	const stepIndex =
		step === 'verifying' ? 0 : step === 'set-password' ? 1 : step === 'complete-profile' ? 2 : 0

	return (
		<div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.1),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f3_100%)] px-4 py-4 text-neutral-950 sm:py-8">
			<div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),transparent)] sm:h-48" />

			<div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
				<div className="hidden rounded-[2rem] border border-white/60 bg-white/55 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-sm lg:block">
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
						<ShieldCheck className="size-4" aria-hidden="true" />
						Secure onboarding
					</div>

					<h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-neutral-950">
						Welcome to TN Cleaning Solutions.
					</h1>

					<p className="mt-4 max-w-xl text-base leading-7 text-neutral-600">
						Set your password, finish your profile, and you will land directly in
						your schedule with access to your day’s work.
					</p>

					<div className="mt-8 space-y-3">
						<div className="grid gap-3">
							<StepBadge
								number={1}
								label="Verify the invite"
								active={stepIndex === 0}
								done={stepIndex > 0}
							/>
							<StepBadge
								number={2}
								label="Create a password"
								active={stepIndex === 1}
								done={stepIndex > 1}
							/>
							<StepBadge
								number={3}
								label="Complete your profile"
								active={stepIndex === 2}
								done={stepIndex > 2}
							/>
						</div>

						<div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50/90 p-5 text-sm leading-6 text-neutral-600">
							Once you finish setup, the app will create your employee record and
							send you to the schedule page automatically.
						</div>
					</div>
				</div>

				<div>
					<div className="mb-4 text-center sm:mb-6 lg:hidden">
						<div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-semibold tracking-[0.22em] text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] ring-1 ring-inset ring-white/10">
							TN
						</div>
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-emerald-700/80">
							Team invitation
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
							Accept your invite
						</h1>
					</div>

					<Card className="border-neutral-200/80 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
						<CardHeader className="space-y-4 border-b border-neutral-200/80 bg-neutral-50/70 px-4 py-4 sm:px-6 sm:py-5">
							<div className="flex items-center gap-2 text-emerald-700">
								<KeyRound className="size-4" aria-hidden="true" />
								<span className="text-xs font-semibold uppercase tracking-[0.22em]">
									Invitation setup
								</span>
							</div>

							<CardTitle className="text-2xl font-semibold tracking-tight text-neutral-950">
								{step === 'error'
									? 'We could not verify that invite'
									: step === 'set-password'
										? 'Create your password'
										: step === 'complete-profile'
											? 'Complete your profile'
											: 'Verifying your invite'}
							</CardTitle>

							<div className="grid gap-2 sm:grid-cols-3">
								<StepBadge
									number={1}
									label="Invite"
									active={stepIndex === 0}
									done={stepIndex > 0}
								/>
								<StepBadge
									number={2}
									label="Password"
									active={stepIndex === 1}
									done={stepIndex > 1}
								/>
								<StepBadge
									number={3}
									label="Profile"
									active={stepIndex === 2}
									done={stepIndex > 2}
								/>
							</div>
						</CardHeader>

						<CardContent className="px-4 py-4 sm:px-6 sm:py-6">
							{step === 'verifying' ? (
								<div className="flex min-h-65 flex-col items-center justify-center gap-4 text-center">
									<div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
										<Loader2 className="size-6 animate-spin" aria-hidden="true" />
									</div>
									<div>
										<p className="text-lg font-semibold text-neutral-950">
											Verifying your invitation
										</p>
										<p className="mt-1 text-sm leading-6 text-neutral-600">
											We are checking the invite link and preparing your account.
										</p>
									</div>
								</div>
							) : null}

							{step === 'error' ? (
								<div className="space-y-4">
									<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
										{error}
									</div>

									<div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
										Ask your administrator to resend the invitation if this link
										has expired or was copied incorrectly.
									</div>

									<div className="flex flex-col gap-3 sm:flex-row">
										<Button
											className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700"
										>
											<Link href="/login">
												Back to login
												<ArrowRight className="ml-2 size-4" aria-hidden="true" />
											</Link>
										</Button>
									</div>
								</div>
							) : null}

							{step === 'set-password' ? (
								<div className="space-y-5">
									<div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
										<KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
										<p>
											Your invite was verified. Create the password you will use to
											sign in next time.
										</p>
									</div>

									<SetPasswordForm onSuccess={() => setStep('complete-profile')} />
								</div>
							) : null}

							{step === 'complete-profile' ? (
								<div className="space-y-5">
									<div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700">
										<UserRound className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
										<p>
											Your password is set. Finish the profile details below so
											the operations team can keep your account in sync.
										</p>
									</div>

									<CompleteProfileForm />
								</div>
							) : null}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
