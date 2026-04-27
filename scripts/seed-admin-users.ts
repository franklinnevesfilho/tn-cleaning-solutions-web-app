/**
 * Seed admin and employee users using Supabase Admin API
 * 
 * This script creates users with proper password hashing
 * Run with: npm run seed:admin
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface User {
  email: string
  password: string
  fullName: string
  role: 'admin' | 'employee'
  phone?: string
}

const users: User[] = [
  {
    email: 'franklin.neves.filho@gmail.com',
    password: 'admin123',
    fullName: 'Franklin Neves Filho',
    role: 'admin',
  },
  {
    email: 'sarah.johnson@tncleaningsolutions.com',
    password: 'employee123',
    fullName: 'Sarah Johnson',
    role: 'employee',
    phone: '(615) 555-0123',
  },
]

async function seedUsers() {
  console.log('🌱 Seeding users...\n')

  for (const user of users) {
    const roleEmoji = user.role === 'admin' ? '👑' : '👤'
    console.log(`${roleEmoji} Processing ${user.email} (${user.role})...`)

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser?.users.some((u) => u.email === user.email)

    if (userExists) {
      console.log(`   ⚠️  User already exists, updating...`)

      // Get user ID
      const existingUserData = existingUser?.users.find((u) => u.email === user.email)
      if (existingUserData) {
        // Update user metadata to ensure correct role
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUserData.id,
          {
            app_metadata: { role: user.role },
            password: user.password, // Update password
          }
        )

        if (updateError) {
          console.error(`   ❌ Failed to update user: ${updateError.message}`)
          continue
        }

        // Ensure employee record exists
        const { error: employeeError } = await supabase
          .from('employees')
          .upsert(
            {
              user_id: existingUserData.id,
              full_name: user.fullName,
              phone: user.phone || null,
              is_active: true,
            },
            {
              onConflict: 'user_id',
            }
          )

        if (employeeError) {
          console.error(`   ⚠️  Employee record error: ${employeeError.message}`)
        }

        console.log(`   ✅ Updated successfully`)
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        app_metadata: { role: user.role },
      })

      if (createError) {
        console.error(`   ❌ Failed to create user: ${createError.message}`)
        continue
      }

      if (newUser.user) {
        // Create employee record
        const { error: employeeError } = await supabase.from('employees').insert({
          user_id: newUser.user.id,
          full_name: user.fullName,
          phone: user.phone || null,
          is_active: true,
        })

        if (employeeError) {
          console.error(`   ⚠️  Employee record error: ${employeeError.message}`)
        }

        console.log(`   ✅ Created successfully`)
      }
    }
  }

  console.log('\n✨ Done! All users are ready.')

  // Create test appointment data
  await seedTestData()

  console.log('\n📋 Test Users:')
  console.log('   Admin:')
  console.log('   - franklin.neves.filho@gmail.com / admin123')
  console.log('\n   Employees:')
  console.log('   - sarah.johnson@tncleaningsolutions.com / employee123')
  console.log('\n⚠️  SECURITY WARNING:')
  console.log('   Change default passwords immediately in production!')
}

async function seedTestData() {
  console.log('\n🧪 Creating test appointment data...\n')

  // Get employee IDs
  const { data: franklinUser } = await supabase.auth.admin.listUsers()
  const franklinAuthUser = franklinUser?.users.find(
    (u) => u.email === 'franklin.neves.filho@gmail.com'
  )
  const sarahAuthUser = franklinUser?.users.find(
    (u) => u.email === 'sarah.johnson@tncleaningsolutions.com'
  )

  if (!franklinAuthUser || !sarahAuthUser) {
    console.log('   ⚠️  Skipping test data - employee users not found')
    return
  }

  const { data: sarahEmployee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', sarahAuthUser.id)
    .single()

  if (!sarahEmployee) {
    console.log('   ⚠️  Skipping test data - employee records not found')
    return
  }

  // Check if test client exists, create if not
  let { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('name', 'Johnson Family')
    .maybeSingle()

  if (!client) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Johnson Family',
        email: 'mjohnson@email.com',
        phone: '(615) 555-0200',
        address: '123 Main St, Nashville, TN 37201',
        notes: 'Weekly cleaning, has a friendly golden retriever named Max',
        is_active: true,
      })
      .select()
      .single()

    if (clientError) {
      console.error(`   ❌ Failed to create client: ${clientError.message}`)
      return
    }

    client = newClient
    console.log('   ✅ Created test client: Johnson Family')
  } else {
    console.log('   ℹ️  Using existing test client: Johnson Family')
  }

  // Check if test job exists, create if not
  let { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('name', 'Standard House Cleaning')
    .maybeSingle()

  if (!job) {
    const { data: newJob, error: jobError } = await supabase
      .from('jobs')
      .insert({
        name: 'Standard House Cleaning',
        description:
          'Complete house cleaning including kitchen, bathrooms, living areas, and bedrooms',
        base_price_cents: 15000,
        estimated_duration_minutes: 120,
      })
      .select()
      .single()

    if (jobError) {
      console.error(`   ❌ Failed to create job: ${jobError.message}`)
      return
    }

    job = newJob
    console.log('   ✅ Created test job: Standard House Cleaning')
  } else {
    console.log('   ℹ️  Using existing test job: Standard House Cleaning')
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  // Check if appointment already exists for today
  const { data: existingAppointment } = await supabase
    .from('appointments')
    .select('id')
    .eq('client_id', client?.id)
    .eq('job_id', job?.id)
    .eq('scheduled_date', today)
    .eq('scheduled_start_time', '09:00:00')
    .maybeSingle()

  let appointment = existingAppointment

  if (!appointment) {
    const { data: newAppointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        client_id: client?.id,
        job_id: job?.id,
        scheduled_date: today,
        scheduled_start_time: '09:00:00',
        scheduled_end_time: '11:00:00',
        status: 'scheduled',
        notes:
          'First visit - client will leave the key under the front door mat. The dog is friendly but energetic.',
      })
      .select()
      .single()

    if (appointmentError) {
      console.error(`   ❌ Failed to create appointment: ${appointmentError.message}`)
      return
    }

    appointment = newAppointment
    console.log(`   ✅ Created test appointment for today (${today}) at 9:00 AM`)
  } else {
    console.log(`   ℹ️  Using existing test appointment for today (${today})`)
  }

  const { error: sarahAssignError } = await supabase
    .from('appointment_employees')
    .insert({
      appointment_id: appointment?.id,
      employee_id: sarahEmployee.id,
    })

  if (sarahAssignError && sarahAssignError.code !== '23505') {
    // Ignore duplicate key errors
    console.error(`   ⚠️  Failed to assign Sarah: ${sarahAssignError.message}`)
  } else if (sarahAssignError?.code === '23505') {
    console.log('   ℹ️  Sarah already assigned')
  } else {
    console.log('   ✅ Assigned Sarah to appointment')
  }

  console.log('\n🎉 Test data created successfully!')
}

seedUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
