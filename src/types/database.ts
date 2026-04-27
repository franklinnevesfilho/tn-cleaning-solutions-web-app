export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          user_id: string
          full_name: string
          phone: string
          is_active: boolean
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          phone: string
          is_active: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          phone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          address: string
          notes: string
          is_active: boolean
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          address: string
          notes: string
          is_active: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          address?: string
          notes?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      client_locations: {
        Row: {
          id: string
          client_id: string
          label: string
          address: string
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          client_id: string
          label?: string
          address: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          client_id?: string
          label?: string
          address?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      jobs: {
        Row: {
          id: string
          name: string
          description: string
          base_price_cents: number
          estimated_duration_minutes: number
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          name: string
          description: string
          base_price_cents: number
          estimated_duration_minutes: number
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          name?: string
          description?: string
          base_price_cents?: number
          estimated_duration_minutes?: number
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      recurrence_series: {
        Row: {
          id: string
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
          start_date: string
          end_date: string | null
          max_occurrences: number | null
          client_id: string
          job_id: string
          location_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
          start_date: string
          end_date?: string | null
          max_occurrences?: number | null
          client_id: string
          job_id: string
          location_id?: string | null
          is_active: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
          start_date?: string
          end_date?: string | null
          max_occurrences?: number | null
          client_id?: string
          job_id?: string
          location_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      appointments: {
        Row: {
          id: string
          client_id: string
          job_id: string
          recurrence_series_id: string | null
          location_id: string | null
          scheduled_date: string
          scheduled_start_time: string
          scheduled_end_time: string
          price_override_cents: number | null
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes: string
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          client_id: string
          job_id: string
          recurrence_series_id?: string | null
          location_id?: string | null
          scheduled_date: string
          scheduled_start_time: string
          scheduled_end_time: string
          price_override_cents?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          client_id?: string
          job_id?: string
          recurrence_series_id?: string | null
          location_id?: string | null
          scheduled_date?: string
          scheduled_start_time?: string
          scheduled_end_time?: string
          price_override_cents?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes?: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      appointment_employees: {
        Row: {
          id: string
          appointment_id: string
          employee_id: string
          clocked_in_at: string | null
          clocked_out_at: string | null
          admin_notes: string
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          appointment_id: string
          employee_id: string
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          admin_notes: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          appointment_id?: string
          employee_id?: string
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          admin_notes?: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      invoices: {
        Row: {
          id: string
          client_id: string
          status: 'draft' | 'issued' | 'paid' | 'void'
          issued_date: string | null
          due_date: string | null
          total_cents: number
          notes: string
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          id?: string
          client_id: string
          status?: 'draft' | 'issued' | 'paid' | 'void'
          issued_date?: string | null
          due_date?: string | null
          total_cents: number
          notes: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          id?: string
          client_id?: string
          status?: 'draft' | 'issued' | 'paid' | 'void'
          issued_date?: string | null
          due_date?: string | null
          total_cents?: number
          notes?: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
      invoice_appointments: {
        Row: {
          invoice_id: string
          appointment_id: string
          created_at: string
          updated_at: string
          is_archived: boolean
        }
        Insert: {
          invoice_id: string
          appointment_id: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
        Update: {
          invoice_id?: string
          appointment_id?: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']