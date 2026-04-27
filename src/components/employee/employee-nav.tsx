'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Clock3, UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

const navItems = [
	{ label: 'Schedule', href: '/solutions/schedule', icon: CalendarDays },
	{ label: 'Time Sheets', href: '/solutions/time-sheets', icon: Clock3 },
	{ label: 'Profile', href: '/solutions/profile', icon: UserRound },
] as const

export function EmployeeNav() {
	const pathname = usePathname() ?? ''

	return (
		<header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/90 backdrop-blur-xl">
			<div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
				<Link href="/solutions/schedule" className="flex min-w-0 items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20">
						TN
					</div>
					<div className="min-w-0">
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-emerald-700">
							TN Cleaning Solutions
						</p>
						<h1 className="truncate text-sm font-semibold tracking-tight text-neutral-950 sm:text-base">
							Employee Portal
						</h1>
					</div>
				</Link>

				<nav
					aria-label="Employee navigation"
					className="flex min-w-0 flex-1 justify-center overflow-x-auto"
				>
					<div className="flex min-w-max items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1 shadow-sm shadow-neutral-950/5">
						{navItems.map((item) => {
							const Icon = item.icon
							const isActive =
								pathname === item.href || pathname.startsWith(`${item.href}/`)

							return (
								<Link
									key={item.href}
									href={item.href}
									aria-current={isActive ? 'page' : undefined}
									className={cn(
										'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
										isActive
											? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
											: 'text-neutral-600 hover:bg-white hover:text-neutral-950'
									)}
								>
									<Icon
										className={cn('size-4 shrink-0', isActive ? 'text-white' : 'text-neutral-400')}
										aria-hidden="true"
									/>
									<span>{item.label}</span>
								</Link>
							)
						})}
					</div>
				</nav>

				<div className="hidden items-center justify-end md:flex">
					<div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 shadow-sm shadow-neutral-950/5">
						<span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
						<span>Ready for shift</span>
					</div>
				</div>
			</div>
		</header>
	)
}