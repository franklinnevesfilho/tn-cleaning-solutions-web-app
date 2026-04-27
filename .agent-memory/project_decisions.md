## Supabase SSR Dependencies Added — 2026-04-24

### Facts
- Installed `@supabase/supabase-js`, `@supabase/ssr`, and `server-only` in the Next.js app root.
- Resolved top-level versions are `@supabase/supabase-js@2.104.1`, `@supabase/ssr@0.10.2`, and `server-only@0.0.1`.
- The dependencies are now listed in [package.json](../package.json).

### Inferences
- These packages are the baseline for upcoming Supabase Auth + SSR integration work.

### Decision
- Use the installed Supabase JS and SSR packages as the project foundation for server/client Supabase auth flows in this app.

### Consequences
- Future Supabase integration work should build on these dependencies rather than adding alternate client wrappers.

### Citations
- [package.json](../package.json)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot

## Admin Shell with Server Guard and Client Sidebar — 2026-04-24

### Facts
- The admin route group now has a dedicated layout at [src/app/(internal)/solutions/(admin)/layout.tsx](../src/app/(internal)/solutions/(admin)/layout.tsx).
- The layout checks `supabase.auth.getUser()` server-side and redirects non-admin users to `/solutions/schedule`, with unauthenticated users sent to `/login`.
- The sidebar lives in [src/components/admin/sidebar-nav.tsx](../src/components/admin/sidebar-nav.tsx) as a Client Component that uses `usePathname()` for active nav state.
- The logout control submits a Server Action from the layout rather than handling auth state entirely on the client.

### Inferences
- The admin shell is now the canonical place for privileged navigation and session exit in this app.

### Decision
- Keep the admin portal shell server-rendered for authorization and session handling, and keep route-aware navigation in the client sidebar only.

### Consequences
- Future admin pages should mount under the `(admin)` layout and reuse the sidebar contract instead of duplicating route guards or navigation chrome.

### Citations
- [src/app/(internal)/solutions/(admin)/layout.tsx](../src/app/(internal)/solutions/(admin)/layout.tsx)
- [src/components/admin/sidebar-nav.tsx](../src/components/admin/sidebar-nav.tsx)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot

## Employee Shell with Top Navigation — 2026-04-24

### Facts
- The employee route group now has a dedicated layout at [src/app/(internal)/solutions/(employee)/layout.tsx](../src/app/(internal)/solutions/(employee)/layout.tsx).
- The employee shell uses a client nav component at [src/components/employee/employee-nav.tsx](../src/components/employee/employee-nav.tsx) with `usePathname()` for active state highlighting.
- The navigation contains three task-focused destinations in this order: Schedule, Time Sheets, and Profile.
- The employee layout does not add a separate role guard; the shared internal layout continues to handle authentication for the route group.

### Inferences
- The employee portal should stay lighter than the admin shell and favor quick access to the next task over dense navigation.

### Decision
- Use a simple top navigation shell for employee-facing routes, with pathname-aware active pills and mobile horizontal overflow instead of a sidebar.

### Consequences
- Future employee pages should mount under the `(employee)` layout and reuse the top-nav contract rather than introducing a second admin-style sidebar.

### Citations
- [src/app/(internal)/solutions/(employee)/layout.tsx](../src/app/(internal)/solutions/(employee)/layout.tsx)
- [src/components/employee/employee-nav.tsx](../src/components/employee/employee-nav.tsx)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot

## Invite Onboarding Flow and Email Template Wiring — 2026-04-24

### Facts
- The invite flow is implemented at [src/app/(auth)/accept-invite/page.tsx](../src/app/(auth)/accept-invite/page.tsx) and verifies `token_hash` with `supabase.auth.verifyOtp({ type: 'invite' })` before showing the password and profile steps.
- Profile completion writes to the `employees` table through a server action in [src/app/(auth)/accept-invite/actions.ts](../src/app/(auth)/accept-invite/actions.ts) using the service-role admin client.
- Local Supabase auth config now points `site_url` at `http://localhost:3000`, allows `/accept-invite`, and disables email signup in [supabase/config.toml](../supabase/config.toml).
- The custom invite email template lives at [supabase/templates/invite-email.html](../supabase/templates/invite-email.html) and links directly to the accept-invite page with `{{ .TokenHash }}`.
- Local email capture for testing uses the Supabase dev inbox at `http://localhost:54324`.

### Inferences
- Invite-based onboarding is now the canonical path for employee account activation in this app.

### Decision
- Keep invite onboarding as a custom three-step client flow backed by a server-side profile-upsert action, and use a dedicated Supabase invite email template that links straight into the app.

### Consequences
- Future invite or onboarding changes should preserve the `token_hash` invite verification contract, the server-side `employees` upsert, and the invite-only auth configuration.

### Citations
- [src/app/(auth)/accept-invite/page.tsx](../src/app/(auth)/accept-invite/page.tsx)
- [src/app/(auth)/accept-invite/actions.ts](../src/app/(auth)/accept-invite/actions.ts)
- [supabase/config.toml](../supabase/config.toml)
- [supabase/templates/invite-email.html](../supabase/templates/invite-email.html)
- [docs/email-templates.md](../docs/email-templates.md)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot

## Shared Profile Settings Page — 2026-04-24

### Facts
- The shared profile page now lives at [src/app/(internal)/solutions/profile/page.tsx](../src/app/(internal)/solutions/profile/page.tsx) and redirects unauthenticated users to `/login`.
- The page reads the current session with `supabase.auth.getUser()`, shows the authenticated email, derives the role from `app_metadata.role`, and formats the account created date from `user.created_at`.
- Profile updates go through [src/lib/actions/profile.ts](../src/lib/actions/profile.ts), which revalidates `/solutions/profile` after updating `employees.full_name` and `employees.phone` with the service-role client.
- Password changes also go through [src/lib/actions/profile.ts](../src/lib/actions/profile.ts) and use `supabase.auth.updateUser({ password })` after validating minimum length and password confirmation.
- The admin sidebar now links to `/solutions/profile` in [src/components/admin/sidebar-nav.tsx](../src/components/admin/sidebar-nav.tsx), and the employee nav already exposed the same route.

### Inferences
- Profile settings should remain a shared authenticated destination rather than a role-specific page.

### Decision
- Keep profile identity/contact updates in a dedicated server-action module, surface them through client form components with inline success/error feedback, and expose the route from both portal shells.

### Consequences
- Future changes to user contact data or password handling should preserve the `employees` update path, the Supabase auth password update flow, and the shared `/solutions/profile` route contract.

### Citations
- [src/app/(internal)/solutions/profile/page.tsx](../src/app/(internal)/solutions/profile/page.tsx)
- [src/lib/actions/profile.ts](../src/lib/actions/profile.ts)
- [src/components/profile/profile-form.tsx](../src/components/profile/profile-form.tsx)
- [src/components/profile/password-form.tsx](../src/components/profile/password-form.tsx)
- [src/components/admin/sidebar-nav.tsx](../src/components/admin/sidebar-nav.tsx)

### memory_meta
- timestamp: 2026-04-24
- author: GitHub Copilot
