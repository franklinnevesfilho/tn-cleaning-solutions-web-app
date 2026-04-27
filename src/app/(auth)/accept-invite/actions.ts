'use server'

import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type CompleteProfileState = {
  error: string | null
}

const initialState: CompleteProfileState = {
  error: null,
}

export async function completeProfile(
  _previousState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ...initialState,
      error: 'Not authenticated.',
    }
  }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()

  if (!fullName) {
    return {
      ...initialState,
      error: 'Full name is required.',
    }
  }

  if (!phone) {
    return {
      ...initialState,
      error: 'Phone number is required.',
    }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('employees').upsert(
    {
      user_id: user.id,
      full_name: fullName,
      phone,
      is_active: true,
    },
    {
      onConflict: 'user_id',
    }
  )

  if (error) {
    return {
      ...initialState,
      error: error.message,
    }
  }

  redirect('/solutions/schedule')
}