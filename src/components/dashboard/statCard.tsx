import Link from 'next/link'

interface StatCardProps {
    statValue: number,
    statLabel: string,
    statDescription?: string,
    href: string,
    icon?: React.ReactNode,
    classColor?: string,
    borderColor?: {
        color?: string,
        onHover?: string,
    },
    shadowColor?: string,
}
export default function StatCard({ statValue, statLabel, statDescription, href, icon, classColor, borderColor, shadowColor }: StatCardProps){
    return(
        <Link
            href={href}
            className={`group rounded-2xl border ${borderColor?.color ?? 'border-emerald-200'} bg-white p-4 sm:p-5 shadow-sm ${shadowColor ?? 'shadow-emerald-950/5'} transition-colors hover:border-${borderColor?.onHover ?? 'emerald-300'} flex flex-col`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl ${classColor ?? 'bg-emerald-50 text-emerald-700'}`}>
                    {icon}
                </span>
            </div>
            <p className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950">{statValue}</p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-700">{statLabel}</p>
            {statDescription && (
                <p className="hidden md:flex mt-1 text-[10px] sm:text-xs text-neutral-500 leading-snug">{statDescription}</p>
            )}
        </Link>
    )
}