import { redirect } from 'next/navigation'

type JobIdPageProps = {
	params: Promise<{ id: string }>
}

export default async function JobIdPage({ params }: JobIdPageProps) {
	const { id } = await params
	redirect(`/solutions/jobs/${id}/edit`)
}
