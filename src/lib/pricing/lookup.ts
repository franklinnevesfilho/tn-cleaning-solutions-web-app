import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'
import type { ClientJobRule } from './resolve'

export async function fetchClientJobRules(
  client: SupabaseClient<Database>,
  pairs: Array<{ clientId: string; jobId: string }>
): Promise<Map<string, ClientJobRule[]>> {
  const rulesByPair = new Map<string, ClientJobRule[]>()

  if (pairs.length > 0) {
    const clientIds = Array.from(new Set(pairs.map((pair) => pair.clientId)))
    const jobIds = Array.from(new Set(pairs.map((pair) => pair.jobId)))

    // `.in(client_id) x .in(job_id)` fetches the cross product of the distinct values, not only
    // the requested pairs. That over-fetch is intended: one round trip instead of one per pair,
    // and the map key drops the rows nobody asked for. Do not "fix" this into N queries.
    const { data, error } = await client
      .from('client_job_pricing')
      .select('client_id, job_id, hourly_rate_cents, effective_from, is_archived')
      .in('client_id', clientIds)
      .in('job_id', jobIds)
      .eq('is_archived', false)

    if (error) {
      throw error
    }

    for (const row of data) {
      const key = `${row.client_id}:${row.job_id}`
      const existing = rulesByPair.get(key)

      if (existing) {
        existing.push(row)
      } else {
        rulesByPair.set(key, [row])
      }
    }
  }

  return rulesByPair
}
