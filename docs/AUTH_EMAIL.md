# Auth email templates (hosted Supabase)

HomeLens sign-in uses **email OTP codes** via `verifyOtp({ type: 'email' })`.

The Magic Link template must include `{{ .Token }}` so users receive a 6-digit code.

## Free tier limitation

Supabase blocks API/`config push` template edits on free projects that still use the **default email provider**:

> Email template modification is not available for free tier projects using the default email provider.

### Fix (pick one)

1. **Dashboard (if available):** Authentication → Email → Templates → Magic link  
   Paste the HTML from `supabase/templates/magic_link.html` and subject `Your HomeLens sign-in code`.

2. **Custom SMTP** (required for API template pushes on free tier): configure SMTP under Authentication → SMTP, then run:

```powershell
npx supabase config push --yes
```

Until the template includes `{{ .Token }}`, users can still sign in with the **email link** (`/auth/callback`). Code entry works as soon as the template is updated.
