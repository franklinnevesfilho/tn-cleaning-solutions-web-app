'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

type EmployeeFieldErrors = {
  email?: string
  full_name?: string
  started_at?: string
  e_transfer_email?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type EmployeeActionResult =
  | { success: true; data?: { id?: string; email?: string } }
  | { success: false; error: string; fieldErrors?: EmployeeFieldErrors }

type ParsedInviteInput = {
  email: string
  full_name: string
}

type ParsedEmployeeUpdateInput = {
  full_name: string
  phone: string | null
  started_at: string | null
  address: string | null
  e_transfer_email: string | null
  is_active: boolean
}

async function requireAdminRole(): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseClient()
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

function parseInviteFormData(formData: FormData):
  | { success: true; data: ParsedInviteInput }
  | { success: false; error: string; fieldErrors: EmployeeFieldErrors } {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') ?? '').trim()

  const fieldErrors: EmployeeFieldErrors = {}

  if (!email) {
    fieldErrors.email = 'Email is required.'
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'Enter a valid email address.'
  }

  if (!fullName) {
    fieldErrors.full_name = 'Full name is required.'
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
      email,
      full_name: fullName,
    },
  }
}

function parseUpdateFormData(formData: FormData):
  | { success: true; data: ParsedEmployeeUpdateInput }
  | { success: false; error: string; fieldErrors: EmployeeFieldErrors } {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const phoneRaw = String(formData.get('phone') ?? '').trim()
  const startedAtRaw = String(formData.get('started_at') ?? '').trim()
  const addressRaw = String(formData.get('address') ?? '').trim()
  const eTransferEmailRaw = String(formData.get('e_transfer_email') ?? '')
    .trim()
    .toLowerCase()
  const isActive = formData.get('is_active') === 'on'

  const fieldErrors: EmployeeFieldErrors = {}

  if (!fullName) {
    fieldErrors.full_name = 'Full name is required.'
  }

  if (startedAtRaw && !isCalendarDate(startedAtRaw)) {
    fieldErrors.started_at = 'Enter a valid date.'
  }

  if (eTransferEmailRaw && !EMAIL_PATTERN.test(eTransferEmailRaw)) {
    fieldErrors.e_transfer_email = 'Enter a valid email address.'
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
      full_name: fullName,
      phone: phoneRaw || null,
      started_at: startedAtRaw || null,
      address: addressRaw || null,
      e_transfer_email: eTransferEmailRaw || null,
      is_active: isActive,
    },
  }
}

function isCalendarDate(value: string): boolean {
  let valid = false

  if (ISO_DATE_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`)
    valid = !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  }

  return valid
}

export async function inviteEmployee(formData: FormData): Promise<EmployeeActionResult>
export async function inviteEmployee(
  _prevState: EmployeeActionResult,
  formData: FormData
): Promise<EmployeeActionResult>
export async function inviteEmployee(
  firstArg: FormData | EmployeeActionResult,
  secondArg?: FormData
): Promise<EmployeeActionResult> {
  const formData = firstArg instanceof FormData ? firstArg : secondArg

  if (!formData) {
    return { success: false, error: 'Invalid form submission.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const parsed = parseInviteFormData(formData)
  if (!parsed.success) {
    return parsed
  }

  try {
    const adminClient = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        redirectTo: `${appUrl}/accept-invite`,
        data: {},
      }
    )

    if (inviteError) {
      return { success: false, error: inviteError.message }
    }

    const userId = inviteData.user?.id
    if (!userId) {
      return { success: false, error: 'Invite sent, but user id was not returned by Supabase.' }
    }

    const { error: roleError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: 'employee',
      },
    })

    if (roleError) {
      return { success: false, error: roleError.message }
    }

    const { error: upsertError } = await adminClient.from('employees').upsert(
      {
        user_id: userId,
        full_name: parsed.data.full_name,
        is_active: true,
        is_archived: false,
      },
      {
        onConflict: 'user_id',
      }
    )

    if (upsertError) {
      return { success: false, error: upsertError.message }
    }
  } catch {
    return { success: false, error: 'Failed to send invite.' }
  }

  revalidatePath('/solutions/employees')
  return { success: true, data: { email: parsed.data.email } }
}

export async function updateEmployee(id: string, formData: FormData): Promise<EmployeeActionResult>
export async function updateEmployee(
  id: string,
  _prevState: EmployeeActionResult,
  formData: FormData
): Promise<EmployeeActionResult>
export async function updateEmployee(
  id: string,
  secondArg: FormData | EmployeeActionResult,
  thirdArg?: FormData
): Promise<EmployeeActionResult> {
  const formData = secondArg instanceof FormData ? secondArg : thirdArg

  if (!id) {
    return { success: false, error: 'Employee id is required.' }
  }

  if (!formData) {
    return { success: false, error: 'Invalid form submission.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const parsed = parseUpdateFormData(formData)
  if (!parsed.success) {
    return parsed
  }

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('employees')
      .update(parsed.data)
      .eq('id', id)
      .eq('is_archived', false)
      .select('id')
      .maybeSingle()

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Employee not found.' }
    }
  } catch {
    return { success: false, error: 'Failed to update employee.' }
  }

  revalidatePath('/solutions/employees')
  revalidatePath(`/solutions/employees/${id}`)
  redirect('/solutions/employees')

  return { success: true, data: { id } }
}

export async function deactivateEmployee(id: string): Promise<EmployeeActionResult> {
  if (!id) {
    return { success: false, error: 'Employee id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('employees')
    .update({ is_active: false })
    .eq('id', id)
    .eq('is_archived', false)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/solutions/employees')
  revalidatePath(`/solutions/employees/${id}`)
  return { success: true }
}

export async function activateEmployee(id: string): Promise<EmployeeActionResult> {
  if (!id) {
    return { success: false, error: 'Employee id is required.' }
  }

  const authResult = await requireAdminRole()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('employees')
    .update({ is_active: true })
    .eq('id', id)
    .eq('is_archived', false)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/solutions/employees')
  revalidatePath(`/solutions/employees/${id}`)
  return { success: true }
}