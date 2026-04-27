export type AppointmentSummary = {
  id: string
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  price_override_cents: number | null
  client: {
    id: string
    name: string
  }
  job: {
    id: string
    name: string
    base_price_cents: number
  }
  location: {
    label: string
    address: string
  } | null
  assignedEmployees: Array<{
    id: string
    employee_id: string
    full_name: string
  }>
}
