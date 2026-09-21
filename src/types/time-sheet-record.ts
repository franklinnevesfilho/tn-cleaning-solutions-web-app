export type TimeSheetRecord = {
	id: string
	clocked_in_at: string | null
	clocked_out_at: string | null
	appointments: {
		scheduled_date: string
		clients: {
			name: string
		}
		jobs: {
			name: string
		}
	}
}