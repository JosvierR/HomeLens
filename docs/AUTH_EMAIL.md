# Auth (demo)

HomeLens demo sign-in uses **email + password**.

OTP/magic-link email codes are intentionally not used for the hosted free-tier project: Supabase blocks Magic Link template edits on free projects created after 2026-06-03 when using the default email provider, so the inbox only receives a magic link and not a usable 6-digit code.

## How to sign in

1. Open `/auth/sign-in`
2. Create an account with email + password (min 6 characters)
3. Sign in with the same credentials

If Supabase has “Confirm email” enabled, open the confirmation email once, then sign in with password.

## Optional OTP later

Local template for OTP-only email lives in `supabase/templates/magic_link.html`.

To enable OTP codes on hosted Supabase:

1. Configure custom SMTP under Authentication → SMTP, **or** upgrade the plan
2. Set the Magic Link template subject/body to show only `{{ .Token }}`
3. Restore `signInWithOtp` / `verifyOtp` in the app

Until then, password login is the supported demo path.
