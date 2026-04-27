'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type InvoiceFieldErrors = {
  client_id?: string
  due_date?: string
  appointment_ids?: string
  prices?: string
}

export type InvoiceActionResult =
  | { success: true; data?: { id: string } }
  | { success: false; error: string; fieldErrors?: InvoiceFieldErrors }

type ParsedInvoiceInput = {
  clientId: string
  dueDate: string | null
  notes: string
  selections: Array<{ appointmentId: string; priceCents: number }>
}

type AppointmentPriceRow = {
  id: string
  client_id: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  is_archived: boolean
  price_override_cents: number | null
  jobs: { base_price_cents: number } | null
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

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function uniqueIds(values: FormDataEntryValue[]) {
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)))
}

function parseMoneyToCents(raw: string) {
  if (!raw) {
    return null
  }

  const parsed = Number(raw)
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * 100)
}

function parseInvoiceFormData(formData: FormData):
  | { success: true; data: ParsedInvoiceInput }
  | { success: false; error: string; fieldErrors: InvoiceFieldErrors } {
  const clientId = String(formData.get('client_id') ?? '').trim()
  const dueDateRaw = String(formData.get('due_date') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const appointmentIds = uniqueIds(formData.getAll('appointment_ids'))

  const fieldErrors: InvoiceFieldErrors = {}

  if (!clientId) {
    fieldErrors.client_id = 'Client is required.'
  }

  if (dueDateRaw && !isValidDate(dueDateRaw)) {
    fieldErrors.due_date = 'Enter a valid due date.'
  }

  if (appointmentIds.length === 0) {
    fieldErrors.appointment_ids = 'Select at least one appointment.'
  }

  const selections: Array<{ appointmentId: string; priceCents: number }> = []
  for (const appointmentId of appointmentIds) {
    const rawPrice = String(formData.get(`price_override_${appointmentId}`) ?? '').trim()
    const priceCents = parseMoneyToCents(rawPrice)

    if (priceCents == null) {
      fieldErrors.prices = 'Each selected appointment must have a valid non-negative price.'
      break
    }

    selections.push({ appointmentId, priceCents })
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
      clientId,
      dueDate: dueDateRaw || null,
      notes,
      selections,
    },
  }
}

async function fetchAppointmentsForPricing(appointmentIds: string[]): Promise<
  { success: true; rows: AppointmentPriceRow[] } | { success: false; error: string }
> {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('appointments')
    .select('id, client_id, status, is_archived, price_override_cents, jobs!inner(base_price_cents)')
    .in('id', appointmentIds)

  if (error) {
    return { success: false, error: error.message }
  }

  const rows = (data ?? []) as unknown as AppointmentPriceRow[]
  if (rows.length !== appointmentIds.length) {
    return { success: false, error: 'One or more selected appointments were not found.' }
  }

  return { success: true, rows }
}

async function applyAppointmentPricesAndGetTotal(
  parsed: ParsedInvoiceInput
): Promise<{ success: true; totalCents: number } | { success: false; error: string }> {
  const pricingResult = await fetchAppointmentsForPricing(parsed.selections.map((item) => item.appointmentId))
  if (!pricingResult.success) {
    return pricingResult
  }

  const byId = new Map(pricingResult.rows.map((row) => [row.id, row]))
  const adminClient = createAdminClient()

  let totalCents = 0

  for (const selection of parsed.selections) {
    const appointment = byId.get(selection.appointmentId)

    if (!appointment) {
      return { success: false, error: 'One or more selected appointments were not found.' }
    }

    if (appointment.client_id !== parsed.clientId) {
      return { success: false, error: 'All selected appointments must belong to the selected client.' }
    }

    if (appointment.is_archived) {
      return { success: false, error: 'Archived appointments cannot be invoiced.' }
    }

    const basePriceCents = appointment.jobs?.base_price_cents ?? 0
    const desiredOverride = selection.priceCents === basePriceCents ? null : selection.priceCents

    if (appointment.price_override_cents !== desiredOverride) {
      const { error } = await adminClient
        .from('appointments')
        .update({ price_override_cents: desiredOverride })
        .eq('id', appointment.id)

      if (error) {
        return { success: false, error: error.message }
      }
    }

    totalCents += selection.priceCents
  }

  return { success: true, totalCents }
}

function isUniqueConstraintError(error: string) {
  const lower = error.toLowerCase()
  return lower.includes('duplicate key') || lower.includes('unique')
}

function revalidateInvoicePaths(invoiceId?: string) {
  revalidatePath('/solutions/invoices')
  if (invoiceId) {
    revalidatePath(`/solutions/invoices/${invoiceId}`)
  }
}

export async function createInvoice(formData: FormData): Promise<InvoiceActionResult>
export async function createInvoice(
  _prevState: InvoiceActionResult,
  formData: FormData
): Promise<InvoiceActionResult>
export async function createInvoice(
  firstArg: FormData | InvoiceActionResult,
  secondArg?: FormData
): Promise<InvoiceActionResult> {
  const formData = firstArg instanceof FormData ? firstArg : secondArg

  if (!formData) {
    return { success: false, error: 'Invalid form submission.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const parsed = parseInvoiceFormData(formData)
  if (!parsed.success) {
    return parsed
  }

  const totalResult = await applyAppointmentPricesAndGetTotal(parsed.data)
  if (!totalResult.success) {
    return { success: false, error: totalResult.error }
  }

  let redirectPath = ''

  try {
    const adminClient = createAdminClient()

    const { data: createdInvoice, error: createError } = await adminClient
      .from('invoices')
      .insert({
        client_id: parsed.data.clientId,
        due_date: parsed.data.dueDate,
        notes: parsed.data.notes,
        status: 'draft',
        total_cents: totalResult.totalCents,
      })
      .select('id')
      .single()

    if (createError) {
      return { success: false, error: createError.message }
    }

    const invoiceId = createdInvoice.id

    const { error: linkError } = await adminClient.from('invoice_appointments').insert(
      parsed.data.selections.map((selection) => ({
        invoice_id: invoiceId,
        appointment_id: selection.appointmentId,
      }))
    )

    if (linkError) {
      if (isUniqueConstraintError(linkError.message)) {
        return {
          success: false,
          error: 'One or more selected appointments are already attached to another invoice.',
        }
      }

      return { success: false, error: linkError.message }
    }

    redirectPath = `/solutions/invoices/${invoiceId}`
  } catch {
    return { success: false, error: 'Failed to create invoice.' }
  }

  revalidateInvoicePaths()
  redirect(redirectPath)

  return { success: true }
}

export async function updateInvoice(id: string, formData: FormData): Promise<InvoiceActionResult>
export async function updateInvoice(
  id: string,
  _prevState: InvoiceActionResult,
  formData: FormData
): Promise<InvoiceActionResult>
export async function updateInvoice(
  id: string,
  secondArg: FormData | InvoiceActionResult,
  thirdArg?: FormData
): Promise<InvoiceActionResult> {
  const formData = secondArg instanceof FormData ? secondArg : thirdArg

  if (!id) {
    return { success: false, error: 'Invoice id is required.' }
  }

  if (!formData) {
    return { success: false, error: 'Invalid form submission.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const parsed = parseInvoiceFormData(formData)
  if (!parsed.success) {
    return parsed
  }

  const adminClient = createAdminClient()

  const { data: currentInvoice, error: invoiceError } = await adminClient
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (invoiceError) {
    return { success: false, error: invoiceError.message }
  }

  if (!currentInvoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (currentInvoice.status !== 'draft') {
    return { success: false, error: 'Only draft invoices can be edited.' }
  }

  const { data: linkedRows, error: linkedError } = await adminClient
    .from('invoice_appointments')
    .select('appointment_id')
    .eq('invoice_id', id)

  if (linkedError) {
    return { success: false, error: linkedError.message }
  }

  const totalResult = await applyAppointmentPricesAndGetTotal(parsed.data)
  if (!totalResult.success) {
    return { success: false, error: totalResult.error }
  }

  let redirectPath = ''

  try {
    const { error: updateInvoiceError } = await adminClient
      .from('invoices')
      .update({
        client_id: parsed.data.clientId,
        due_date: parsed.data.dueDate,
        notes: parsed.data.notes,
        total_cents: totalResult.totalCents,
      })
      .eq('id', id)

    if (updateInvoiceError) {
      return { success: false, error: updateInvoiceError.message }
    }

    const { error: deleteLinksError } = await adminClient
      .from('invoice_appointments')
      .delete()
      .eq('invoice_id', id)

    if (deleteLinksError) {
      return { success: false, error: deleteLinksError.message }
    }

    const { error: insertLinksError } = await adminClient.from('invoice_appointments').insert(
      parsed.data.selections.map((selection) => ({
        invoice_id: id,
        appointment_id: selection.appointmentId,
      }))
    )

    if (insertLinksError) {
      if (isUniqueConstraintError(insertLinksError.message)) {
        return {
          success: false,
          error: 'One or more selected appointments are already attached to another invoice.',
        }
      }

      return { success: false, error: insertLinksError.message }
    }

    redirectPath = `/solutions/invoices/${id}`
  } catch {
    return { success: false, error: 'Failed to update invoice.' }
  }

  revalidateInvoicePaths(id)
  redirect(redirectPath)

  return { success: true, data: { id } }
}

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function issueInvoice(id: string): Promise<InvoiceActionResult> {
  if (!id) {
    return { success: false, error: 'Invoice id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()

  const { data: currentInvoice, error: loadError } = await adminClient
    .from('invoices')
    .select('id, status, issued_date')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return { success: false, error: loadError.message }
  }

  if (!currentInvoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (currentInvoice.status !== 'draft') {
    return { success: false, error: 'Only draft invoices can be issued.' }
  }

  const { error } = await adminClient
    .from('invoices')
    .update({
      status: 'issued',
      issued_date: currentInvoice.issued_date ?? todayDateString(),
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateInvoicePaths(id)
  return { success: true, data: { id } }
}

export async function markInvoicePaid(id: string): Promise<InvoiceActionResult> {
  if (!id) {
    return { success: false, error: 'Invoice id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { data: currentInvoice, error: loadError } = await adminClient
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return { success: false, error: loadError.message }
  }

  if (!currentInvoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (currentInvoice.status !== 'issued') {
    return { success: false, error: 'Only issued invoices can be marked as paid.' }
  }

  const { error } = await adminClient.from('invoices').update({ status: 'paid' }).eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateInvoicePaths(id)
  return { success: true, data: { id } }
}

export async function voidInvoice(id: string): Promise<InvoiceActionResult> {
  if (!id) {
    return { success: false, error: 'Invoice id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { data: currentInvoice, error: loadError } = await adminClient
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return { success: false, error: loadError.message }
  }

  if (!currentInvoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (currentInvoice.status !== 'draft' && currentInvoice.status !== 'issued') {
    return { success: false, error: 'Only draft or issued invoices can be voided.' }
  }

  const { error } = await adminClient.from('invoices').update({ status: 'void' }).eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateInvoicePaths(id)
  return { success: true, data: { id } }
}

export async function archiveInvoice(id: string): Promise<InvoiceActionResult> {
  if (!id) {
    return { success: false, error: 'Invoice id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('invoices').update({ is_archived: true }).eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateInvoicePaths(id)
  return { success: true, data: { id } }
}

export async function restoreInvoice(id: string): Promise<InvoiceActionResult> {
  if (!id) {
    return { success: false, error: 'Invoice id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('invoices').update({ is_archived: false }).eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateInvoicePaths(id)
  return { success: true, data: { id } }
}
