## RLS policy recursion through self-referential joins — 2026-04-24

### Reproduction Signal
- Querying `appointment_employees` joined to `appointments` triggered infinite recursion in the employee appointments path.
- The `appointments` select policy subqueried `public.appointment_employees`, which caused PostgreSQL to evaluate the same RLS policy again.

### Root Cause
- The `appointments` employee policy depended on a direct `SELECT` from `public.appointment_employees` inside the policy body.
- Because `appointment_employees` itself is RLS-protected, the policy recursively re-entered through the join path.

### Fix
- Added a `SECURITY DEFINER` helper function, `public.get_employee_appointment_ids()`, that reads `public.appointment_employees` without triggering RLS.
- Replaced the `appointments` employee select policy to use the helper function and preserved the admin short-circuit with `public.get_user_role() = 'admin'`.

### Prevention
- Avoid reading an RLS-protected table directly from a policy on a related table when the query path can re-enter the same policy.
- Use a narrowly scoped `SECURITY DEFINER` helper for the lookup when the policy must cross that boundary.

### Citations
- [supabase/migrations/20260424200000_fix_appointment_employees_recursion.sql](../supabase/migrations/20260424200000_fix_appointment_employees_recursion.sql)
- [supabase/migrations/20260424194558_enable_rls.sql](../supabase/migrations/20260424194558_enable_rls.sql)
- [supabase/migrations/20260424195000_fix_employee_view_team_members.sql](../supabase/migrations/20260424195000_fix_employee_view_team_members.sql)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot

## Lingering recursive SELECT policy survives alongside replacement — 2026-04-24

### Reproduction Signal
- `appointment_employees` still raised `42P17` after the corrected employee-team policy was added.
- PostgreSQL evaluated both authenticated employee SELECT policies with OR logic, so the older recursive policy continued to fire.

### Root Cause
- Migration `20260424195000` left the recursive policy `Employee select assignments for their appointments` in place after the replacement policy was introduced.

### Fix
- Dropped the old policy with a follow-up migration so only the SECURITY DEFINER-based replacement remained active.

### Prevention
- When replacing an RLS policy, remove the superseded policy in the same change or a follow-up migration before validating the new path.

### Citations
- [supabase/migrations/20260424195000_fix_appointment_employees_recursion.sql](../supabase/migrations/20260424195000_fix_appointment_employees_recursion.sql)
- [supabase/migrations/20260424200100_fix_employee_team_visibility.sql](../supabase/migrations/20260424200100_fix_employee_team_visibility.sql)
- [supabase/migrations/20260424200200_drop_recursive_appointment_employees_policy.sql](../supabase/migrations/20260424200200_drop_recursive_appointment_employees_policy.sql)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot