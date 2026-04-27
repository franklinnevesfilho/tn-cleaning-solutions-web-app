'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/types/database'

type AppointmentFieldErrors = {
  client_id?: string
  job_id?: string
  location_id?: string
  scheduled_date?: string
  scheduled_start_time?: string
  scheduled_end_time?: string
  price_override?: string
  recurrence_frequency?: string
  recurrence_end_date?: string
  recurrence_max_occurrences?: string
  status?: string
}

export type AppointmentActionResult =
  | { success: true; data?: { id?: string; ids?: string[] } }
  | { success: false; error: string; fieldErrors?: AppointmentFieldErrors }

type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

type ParsedCreateAppointmentInput = {
  client_id: string
  job_id: string
  location_id: string | null
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  price_override_cents: number | null
  notes: string
  employee_ids: string[]
  is_recurring: boolean
  recurrence_frequency: RecurrenceFrequency | null
  recurrence_end_date: string | null
  recurrence_max_occurrences: number | null
}

type ParsedUpdateAppointmentInput = {
  job_id: string
  location_id: string | null
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  price_override_cents: number | null
  notes: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  employee_ids: string[]
}

type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function compareTimes(start: string, end: string) {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  return endHour * 60 + endMinute - (startHour * 60 + startMinute)
}

function parseMoneyToCents(raw: string): number | null | 'invalid' {
  if (!raw) {
    return null
  }

  const parsed = Number(raw)
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return 'invalid'
  }

  return Math.round(parsed * 100)
}

function parsePositiveInt(raw: string): number | null | 'invalid' {
  if (!raw) {
    return null
  }

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 'invalid'
  }

  return parsed
}

function uniqueIds(values: FormDataEntryValue[]) {
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)))
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

function addMonths(date: Date, amount: number) {
  const day = date.getUTCDate()
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  base.setUTCMonth(base.getUTCMonth() + amount)

  const endOfTargetMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(day, endOfTargetMonth))
  return base
}

function generateRecurrenceDates(
  startDate: string,
  frequency: RecurrenceFrequency,
  endDate: string | null,
  maxOccurrences: number | null
): string[] {
  const start = parseDate(startDate)
  const effectiveLimit = Math.min(maxOccurrences ?? (endDate ? 365 : 26), 365)
  const dates: string[] = []

  let current = start
  while (dates.length < effectiveLimit) {
    const currentString = formatDate(current)
    if (endDate && currentString > endDate) {
      break
    }

    dates.push(currentString)

    if (frequency === 'daily') {
      current = addDays(current, 1)
    } else if (frequency === 'weekly') {
      current = addDays(current, 7)
    } else if (frequency === 'biweekly') {
      current = addDays(current, 14)
    } else {
      current = addMonths(current, 1)
    }
  }

  return dates
}

async function requireAdminRole(): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (user.app_metadata?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  return { success: true }
}

function parseCreateAppointmentFormData(formData: FormData):
  | { success: true; data: ParsedCreateAppointmentInput }
  | { success: false; error: string; fieldErrors: AppointmentFieldErrors } {
  const clientId = String(formData.get('client_id') ?? '').trim()
  const jobId = String(formData.get('job_id') ?? '').trim()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const scheduledDate = String(formData.get('scheduled_date') ?? '').trim()
  const scheduledStartTime = String(formData.get('scheduled_start_time') ?? '').trim()
  const scheduledEndTime = String(formData.get('scheduled_end_time') ?? '').trim()
  const priceOverride = String(formData.get('price_override') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const employeeIds = uniqueIds(formData.getAll('employee_ids'))

  const isRecurring = formData.get('is_recurring') === 'on'
  const recurrenceFrequencyRaw = String(formData.get('recurrence_frequency') ?? '').trim()
  const recurrenceEndDateRaw = String(formData.get('recurrence_end_date') ?? '').trim()
  const recurrenceMaxOccurrencesRaw = String(formData.get('recurrence_max_occurrences') ?? '').trim()

  const fieldErrors: AppointmentFieldErrors = {}

  if (!clientId) {
    fieldErrors.client_id = 'Client is required.'
  }

  if (!jobId) {
    fieldErrors.job_id = 'Job is required.'
  }

  if (!scheduledDate || !isValidDate(scheduledDate)) {
    fieldErrors.scheduled_date = 'Enter a valid date.'
  }

  if (!scheduledStartTime || !isValidTime(scheduledStartTime)) {
    fieldErrors.scheduled_start_time = 'Enter a valid start time.'
  }

  if (!scheduledEndTime || !isValidTime(scheduledEndTime)) {
    fieldErrors.scheduled_end_time = 'Enter a valid end time.'
  }

  if (
    scheduledStartTime &&
    scheduledEndTime &&
    isValidTime(scheduledStartTime) &&
    isValidTime(scheduledEndTime) &&
    compareTimes(scheduledStartTime, scheduledEndTime) <= 0
  ) {
    fieldErrors.scheduled_end_time = 'End time must be after start time.'
  }

  const parsedPrice = parseMoneyToCents(priceOverride)
  if (parsedPrice === 'invalid') {
    fieldErrors.price_override = 'Enter a valid dollar amount.'
  }

  const priceOverrideCents = parsedPrice === 'invalid' ? null : parsedPrice

  let recurrenceFrequency: RecurrenceFrequency | null = null
  if (isRecurring) {
    if (
      recurrenceFrequencyRaw !== 'daily' &&
      recurrenceFrequencyRaw !== 'weekly' &&
      recurrenceFrequencyRaw !== 'biweekly' &&
      recurrenceFrequencyRaw !== 'monthly'
    ) {
      fieldErrors.recurrence_frequency = 'Select a recurrence frequency.'
    } else {
      recurrenceFrequency = recurrenceFrequencyRaw
    }
  }

  if (isRecurring && recurrenceEndDateRaw && !isValidDate(recurrenceEndDateRaw)) {
    fieldErrors.recurrence_end_date = 'Enter a valid end date.'
  }

  const parsedMaxOccurrences = parsePositiveInt(recurrenceMaxOccurrencesRaw)
  if (isRecurring && parsedMaxOccurrences === 'invalid') {
    fieldErrors.recurrence_max_occurrences = 'Max occurrences must be a whole number greater than zero.'
  }

  const recurrenceMaxOccurrences =
    parsedMaxOccurrences === 'invalid' ? null : parsedMaxOccurrences

  if (
    isRecurring &&
    recurrenceEndDateRaw &&
    isValidDate(recurrenceEndDateRaw) &&
    scheduledDate &&
    isValidDate(scheduledDate) &&
    recurrenceEndDateRaw < scheduledDate
  ) {
    fieldErrors.recurrence_end_date = 'End date must be on or after the appointment date.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      client_id: clientId,
      job_id: jobId,
      location_id: locationId || null,
      scheduled_date: scheduledDate,
      scheduled_start_time: scheduledStartTime,
      scheduled_end_time: scheduledEndTime,
      price_override_cents: priceOverrideCents,
      notes,
      employee_ids: employeeIds,
      is_recurring: isRecurring,
      recurrence_frequency: recurrenceFrequency,
      recurrence_end_date: recurrenceEndDateRaw || null,
      recurrence_max_occurrences: recurrenceMaxOccurrences,
    },
  }
}

function parseUpdateAppointmentFormData(formData: FormData):
  | { success: true; data: ParsedUpdateAppointmentInput }
  | { success: false; error: string; fieldErrors: AppointmentFieldErrors } {
  const jobId = String(formData.get('job_id') ?? '').trim()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const scheduledDate = String(formData.get('scheduled_date') ?? '').trim()
  const scheduledStartTime = String(formData.get('scheduled_start_time') ?? '').trim()
  const scheduledEndTime = String(formData.get('scheduled_end_time') ?? '').trim()
  const priceOverride = String(formData.get('price_override') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const statusRaw = String(formData.get('status') ?? '').trim()
  const employeeIds = uniqueIds(formData.getAll('employee_ids'))

  const fieldErrors: AppointmentFieldErrors = {}

  if (!jobId) {
    fieldErrors.job_id = 'Job is required.'
  }

  if (!scheduledDate || !isValidDate(scheduledDate)) {
    fieldErrors.scheduled_date = 'Enter a valid date.'
  }

  if (!scheduledStartTime || !isValidTime(scheduledStartTime)) {
    fieldErrors.scheduled_start_time = 'Enter a valid start time.'
  }

  if (!scheduledEndTime || !isValidTime(scheduledEndTime)) {
    fieldErrors.scheduled_end_time = 'Enter a valid end time.'
  }

  if (
    scheduledStartTime &&
    scheduledEndTime &&
    isValidTime(scheduledStartTime) &&
    isValidTime(scheduledEndTime) &&
    compareTimes(scheduledStartTime, scheduledEndTime) <= 0
  ) {
    fieldErrors.scheduled_end_time = 'End time must be after start time.'
  }

  const parsedPrice = parseMoneyToCents(priceOverride)
  if (parsedPrice === 'invalid') {
    fieldErrors.price_override = 'Enter a valid dollar amount.'
  }

  const priceOverrideCents = parsedPrice === 'invalid' ? null : parsedPrice

  if (
    statusRaw !== 'scheduled' &&
    statusRaw !== 'in_progress' &&
    statusRaw !== 'completed' &&
    statusRaw !== 'cancelled'
  ) {
    fieldErrors.status = 'Select a valid status.'
  }

  const status = statusRaw as AppointmentStatus

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      job_id: jobId,
      location_id: locationId || null,
      scheduled_date: scheduledDate,
      scheduled_start_time: scheduledStartTime,
      scheduled_end_time: scheduledEndTime,
      price_override_cents: priceOverrideCents,
      notes,
      status,
      employee_ids: employeeIds,
    },
  }
}

export async function createAppointment(formData: FormData): Promise<AppointmentActionResult>
export async function createAppointment(
  _prevState: AppointmentActionResult,
  formData: FormData
): Promise<AppointmentActionResult>
export async function createAppointment(
  firstArg: FormData | AppointmentActionResult,
  secondArg?: FormData
): Promise<AppointmentActionResult> {
  const formData = firstArg instanceof FormData ? firstArg : secondArg

  if (!formData) {
    return { success: false, error: 'Invalid form submission.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const parsed = parseCreateAppointmentFormData(formData)
  if (!parsed.success) {
    return parsed
  }

  let createdAppointmentIds: string[] = []

  try {
    const adminClient = createAdminClient()

    if (parsed.data.is_recurring && parsed.data.recurrence_frequency) {
      const recurrenceInsert: TablesInsert<'recurrence_series'> = {
        client_id: parsed.data.client_id,
        job_id: parsed.data.job_id,
        location_id: parsed.data.location_id,
        frequency: parsed.data.recurrence_frequency,
        start_date: parsed.data.scheduled_date,
        end_date: parsed.data.recurrence_end_date,
        max_occurrences: parsed.data.recurrence_max_occurrences,
        is_active: true,
      }

      const { data: recurrenceSeries, error: recurrenceError } = await adminClient
        .from('recurrence_series')
        .insert(recurrenceInsert)
        .select('id')
        .single()

      if (recurrenceError) {
        return { success: false, error: recurrenceError.message }
      }

      const recurrenceDates = generateRecurrenceDates(
        parsed.data.scheduled_date,
        parsed.data.recurrence_frequency,
        parsed.data.recurrence_end_date,
        parsed.data.recurrence_max_occurrences
      )

      if (recurrenceDates.length === 0) {
        return { success: false, error: 'No recurrence dates were generated.' }
      }

      const appointmentInserts: TablesInsert<'appointments'>[] = recurrenceDates.map((scheduledDate) => ({
        client_id: parsed.data.client_id,
        job_id: parsed.data.job_id,
        recurrence_series_id: recurrenceSeries.id,
        location_id: parsed.data.location_id,
        scheduled_date: scheduledDate,
        scheduled_start_time: parsed.data.scheduled_start_time,
        scheduled_end_time: parsed.data.scheduled_end_time,
        price_override_cents: parsed.data.price_override_cents,
        notes: parsed.data.notes,
        status: 'scheduled',
      }))

      const { data: appointments, error: appointmentsError } = await adminClient
        .from('appointments')
        .insert(appointmentInserts)
        .select('id')

      if (appointmentsError) {
        return { success: false, error: appointmentsError.message }
      }

      createdAppointmentIds = (appointments ?? []).map((row) => row.id)
    } else {
      const singleInsert: TablesInsert<'appointments'> = {
        client_id: parsed.data.client_id,
        job_id: parsed.data.job_id,
        recurrence_series_id: null,
        location_id: parsed.data.location_id,
        scheduled_date: parsed.data.scheduled_date,
        scheduled_start_time: parsed.data.scheduled_start_time,
        scheduled_end_time: parsed.data.scheduled_end_time,
        price_override_cents: parsed.data.price_override_cents,
        notes: parsed.data.notes,
        status: 'scheduled',
      }

      const { data: appointment, error: appointmentError } = await adminClient
        .from('appointments')
        .insert(singleInsert)
        .select('id')
        .single()

      if (appointmentError) {
        return { success: false, error: appointmentError.message }
      }

      createdAppointmentIds = [appointment.id]
    }

    if (parsed.data.employee_ids.length > 0 && createdAppointmentIds.length > 0) {
      const assignmentInserts: TablesInsert<'appointment_employees'>[] = []

      for (const appointmentId of createdAppointmentIds) {
        for (const employeeId of parsed.data.employee_ids) {
          assignmentInserts.push({
            appointment_id: appointmentId,
            employee_id: employeeId,
            admin_notes: '',
          })
        }
      }

      const { error: assignmentError } = await adminClient
        .from('appointment_employees')
        .insert(assignmentInserts)

      if (assignmentError) {
        return { success: false, error: assignmentError.message }
      }
    }
  } catch {
    return { success: false, error: 'Failed to create appointment.' }
  }

  revalidatePath('/solutions/appointments')
  redirect('/solutions/appointments')

  return {
    success: true,
    data: {
      ids: createdAppointmentIds,
      id: createdAppointmentIds[0],
    },
  }
}

export async function updateAppointment(id: string, formData: FormData): Promise<AppointmentActionResult>
export async function updateAppointment(
  id: string,
  _prevState: AppointmentActionResult,
  formData: FormData
): Promise<AppointmentActionResult>
export async function updateAppointment(
  id: string,
  secondArg: FormData | AppointmentActionResult,
  thirdArg?: FormData
): Promise<AppointmentActionResult> {
  const formData = secondArg instanceof FormData ? secondArg : thirdArg

  if (!id) {
    return { success: false, error: 'Appointment id is required.' }
  }

  if (!formData) {
    return { success: false, error: 'Invalid form submission.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const parsed = parseUpdateAppointmentFormData(formData)
  if (!parsed.success) {
    return parsed
  }

  try {
    const adminClient = createAdminClient()

    const { data: appointment, error: appointmentError } = await adminClient
      .from('appointments')
      .update({
        job_id: parsed.data.job_id,
        location_id: parsed.data.location_id,
        scheduled_date: parsed.data.scheduled_date,
        scheduled_start_time: parsed.data.scheduled_start_time,
        scheduled_end_time: parsed.data.scheduled_end_time,
        price_override_cents: parsed.data.price_override_cents,
        notes: parsed.data.notes,
        status: parsed.data.status,
      })
      .eq('id', id)
      .eq('is_archived', false)
      .select('id')
      .maybeSingle()

    if (appointmentError) {
      return { success: false, error: appointmentError.message }
    }

    if (!appointment) {
      return { success: false, error: 'Appointment not found.' }
    }

    const { error: deleteAssignmentsError } = await adminClient
      .from('appointment_employees')
      .delete()
      .eq('appointment_id', id)

    if (deleteAssignmentsError) {
      return { success: false, error: deleteAssignmentsError.message }
    }

    if (parsed.data.employee_ids.length > 0) {
      const assignmentInserts: TablesInsert<'appointment_employees'>[] = parsed.data.employee_ids.map(
        (employeeId) => ({
          appointment_id: id,
          employee_id: employeeId,
          admin_notes: '',
        })
      )

      const { error: assignmentInsertError } = await adminClient
        .from('appointment_employees')
        .insert(assignmentInserts)

      if (assignmentInsertError) {
        return { success: false, error: assignmentInsertError.message }
      }
    }
  } catch {
    return { success: false, error: 'Failed to update appointment.' }
  }

  revalidatePath('/solutions/appointments')
  revalidatePath(`/solutions/appointments/${id}`)
  redirect(`/solutions/appointments/${id}`)

  return { success: true, data: { id } }
}

export async function cancelAppointment(id: string): Promise<AppointmentActionResult> {
  if (!id) {
    return { success: false, error: 'Appointment id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('is_archived', false)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/solutions/appointments')
  revalidatePath(`/solutions/appointments/${id}`)

  return { success: true, data: { id } }
}

export async function updateClockTime(
  appointmentEmployeeId: string,
  field: 'clocked_in_at' | 'clocked_out_at',
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!appointmentEmployeeId) {
    return { success: false, error: 'Appointment employee id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('appointment_employees')
    .update({ [field]: value || null })
    .eq('id', appointmentEmployeeId)
    .eq('is_archived', false)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/solutions/appointments')
  return { success: true }
}

export async function updateAppointmentEmployeeAdminNotes(
  appointmentEmployeeId: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  if (!appointmentEmployeeId) {
    return { success: false, error: 'Appointment employee id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('appointment_employees')
    .update({ admin_notes: value })
    .eq('id', appointmentEmployeeId)
    .eq('is_archived', false)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/solutions/appointments')
  return { success: true }
}
