# Email Templates Configuration

## Local Development

The invite email template is configured in [supabase/config.toml](../supabase/config.toml). The invite email points directly to the custom accept-invite page and works with the local Supabase auth flow.

Testing locally:
- Start Supabase with `supabase start`
- Open the local email inbox at `http://localhost:54324`
- Click the invite link from the captured email to test the full onboarding flow

## Production Setup

In the Supabase Dashboard:

1. Go to Authentication > Email Templates.
2. Select the Invite user template.
3. Paste the HTML from [supabase/templates/invite-email.html](../supabase/templates/invite-email.html).
4. Set the redirect URL allow-list to include your production invite page, such as `https://yourdomain.com/accept-invite`.
5. Save and test the invite flow end to end.

## Important Variables

- `{{ .ConfirmationURL }}` - Standard Supabase confirmation link
- `{{ .TokenHash }}` - Hashed token used by the invite flow
- `{{ .SiteURL }}` - The site URL configured in Supabase
- `{{ .RedirectTo }}` - Redirect target passed to Supabase auth methods

## Email Flow

1. An admin invites an employee with `supabase.auth.admin.inviteUserByEmail()`.
2. Supabase sends the custom invite email.
3. The employee opens `/accept-invite?token_hash=...&type=invite`.
4. The app verifies the invite, sets the password, and completes the profile.
5. The user is redirected to `/solutions/schedule`.

## Testing Notes

- Local email capture uses the Supabase dev inbox at `http://localhost:54324`.
- The custom page expects a `token_hash` query parameter.
- After password setup, the profile completion step writes the employee record using the server action.