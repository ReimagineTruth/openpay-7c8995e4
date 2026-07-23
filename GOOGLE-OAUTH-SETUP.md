# Google Sign-In (Continue with Google)

OpenPay uses **Supabase Auth** with the **Google** provider. The sign-in button on `/sign-in` calls `signInWithGoogle()` and returns to `/auth/callback` to finish the session.

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** (type **Web application**).
3. **Authorized JavaScript origins** (add every domain you use):
   - `https://openpy.space`
   - `http://localhost:5173` (or your Vite dev port)
4. **Authorized redirect URIs** — add Supabase’s callback (not your app URL):
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - Find the exact URL in Supabase → **Authentication** → **Providers** → **Google**.

Copy the **Client ID** and **Client Secret**.

## 2. Supabase Dashboard

1. **Authentication** → **Providers** → **Google** → Enable.
2. Paste **Client ID** and **Client Secret** from Google.
3. **Authentication** → **URL Configuration**:
   - **Site URL**: your production app URL (e.g. `https://openpy.space`).
   - **Redirect URLs** — add each environment:
     - `https://openpy.space/auth/callback`
     - `http://localhost:5173/auth/callback`

## 3. App environment

Ensure `.env` includes:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

Restart the dev server after changes.

## 4. Verify

1. Open `/sign-in` in a normal browser (not Pi Browser — email/Google are hidden there).
2. Click **Continue with Google**.
3. You should return to `/auth/callback`, then land on `/dashboard`.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| 404 after Google | Deploy latest app. Old builds used Lovable `/.lovable/oauth/initiate` (404 on custom domains). New builds use Supabase → Google directly. |
| `redirect_uri_mismatch` | Add Supabase `.../auth/v1/callback` in Google Console redirect URIs. |
| `Invalid redirect URL` | Add `https://your-domain/auth/callback` in Supabase **Redirect URLs**. |
| Session not found on callback | Confirm Google provider is enabled and PKCE/session settings match deployed `supabase/client.ts`. |
