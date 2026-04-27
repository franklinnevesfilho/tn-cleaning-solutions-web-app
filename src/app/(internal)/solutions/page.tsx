import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SolutionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get role from app_metadata (already validated by layout)
  const role = user?.app_metadata?.role as string | undefined

  // Redirect based on role
  if (role === 'admin') {
    redirect('/solutions/dashboard')
  } else {
    // Default to employee portal (includes undefined/missing role)
    redirect('/solutions/schedule')
  }
}