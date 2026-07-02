# PiVerify KYC Integration - Complete Setup Guide

## Overview
This is a standalone KYC verification feature using PiVerify. It's completely isolated from other KYC options and provides ID verification + selfie checks through PiVerify's hosted flow.

## Configuration Details

### Provided API Credentials
- **API Key**: `sbx_b88d08264ab300b0d9398d8ad4e16c4bb774482174501a21` (Sandbox)
- **Base URL**: `https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com`
- **Environment**: Sandbox (simulated results, no billing)

### Webhook Endpoint URL
**Your PiVerify webhook endpoint URL:**
```
https://araojncyittkahvvpdrn.supabase.co/functions/v1/piverify-webhook
```

Use this URL when configuring webhooks in the PiVerify portal.

## Complete Setup Instructions

### Step 1: Configure Environment Variables

The following environment variables are already configured in `.env.example`:

```bash
# PiVerify KYC Integration (Standalone Feature)
PIVERIFY_API_KEY="sbx_b88d08264ab300b0d9398d8ad4e16c4bb774482174501a21"
PIVERIFY_BASE_URL="https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com"
PIVERIFY_WEBHOOK_SECRET="your_webhook_signing_secret_from_piverify_portal"
```

**Important**: Copy `.env.example` to `.env` and update `PIVERIFY_WEBHOOK_SECRET` after you get it from PiVerify.

### Step 2: Set Up Webhook in PiVerify Portal

1. Go to [PiVerify Portal](https://piverify.minepi.com/portal)
2. Navigate to **Webhooks** section
3. Add a new webhook with:
   - **URL**: `https://araojncyittkahvvpdrn.supabase.co/functions/v1/piverify-webhook`
   - **Events**: Select all events:
     - `kyc.session.started`
     - `kyc.session.pending_review`
     - `kyc.session.approved`
     - `kyc.session.rejected`
     - `kyc.session.failed`
4. After creating the webhook, copy the **Signing Secret** provided
5. Update `PIVERIFY_WEBHOOK_SECRET` in your `.env` file with this secret

### Step 3: Deploy Edge Functions

Deploy the updated edge functions to Supabase:

```bash
# From the project root
supabase functions deploy piverify-create-session
supabase functions deploy piverify-webhook
```

### Step 4: Apply Configuration Changes

Apply the Supabase configuration:

```bash
supabase db push
```

### Step 5: Set Environment Variables in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Add the following environment variables:
   - `PIVERIFY_API_KEY`: `sbx_b88d08264ab300b0d9398d8ad4e16c4bb774482174501a21`
   - `PIVERIFY_BASE_URL`: `https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com`
   - `PIVERIFY_WEBHOOK_SECRET`: `[the signing secret from PiVerify portal]`

## How It Works

### User Flow
1. User navigates to the PiVerify KYC page
2. User clicks "Start PiVerify KYC"
3. Frontend calls `piverify-create-session` edge function
4. Edge function creates a session with PiVerify API
5. User is redirected to PiVerify's hosted flow
6. User completes ID upload and selfie verification
7. PiVerify sends webhook to your endpoint with results
8. Database is updated with verification status
9. User can see their verification status on the KYC page

### Edge Functions

#### piverify-create-session
- **Endpoint**: `POST /functions/v1/piverify-create-session`
- **Auth**: Requires user JWT token
- **Purpose**: Creates a new KYC session with PiVerify
- **Returns**: Session ID and hosted flow URL

#### piverify-webhook
- **Endpoint**: `POST /functions/v1/piverify-webhook`
- **Auth**: Signature verification (optional but recommended)
- **Purpose**: Receives verification results from PiVerify
- **Updates**: Session status in database

## Database Schema

The `piverify_sessions` table stores verification sessions:

```sql
CREATE TABLE public.piverify_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  external_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  hosted_flow_url TEXT,
  rejection_reason TEXT,
  allowed_action TEXT,
  last_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Status Values
- `created` - Session created, not started
- `started` - User opened the verification flow
- `pending_review` - Documents submitted, verification in progress
- `approved` - Verification passed
- `rejected` - Verification failed
- `failed` - Provider error

## Standalone Feature Design

This PiVerify integration is completely standalone:

### Isolation from Other KYC Features
- **Separate database table**: `piverify_sessions` is independent
- **Separate edge functions**: No shared code with other KYC systems
- **Separate frontend page**: `PiVerifyKycPage.tsx` is self-contained
- **Independent routing**: No dependencies on other KYC routes
- **Separate environment variables**: Uses `PIVERIFY_*` prefix

### Benefits
- **No conflicts**: Won't affect existing KYC implementations
- **Easy removal**: Can be disabled by removing the page and functions
- **Independent testing**: Can test without affecting other features
- **Scalable**: Can run alongside other KYC providers

## Testing

### Manual Testing

1. **Test Session Creation**:
   ```bash
   # From frontend, navigate to PiVerify KYC page
   # Click "Start PiVerify KYC"
   # Should redirect to PiVerify hosted flow
   ```

2. **Test Webhook**:
   - Complete a verification in PiVerify sandbox
   - Check Supabase function logs for webhook events
   - Verify database shows updated status

3. **Test Status Display**:
   - Navigate back to KYC page
   - Should show current verification status
   - If rejected, should show rejection reason

### API Testing

Test the edge function directly:

```bash
# Test piverify-create-session
curl -X POST https://araojncyittkahvvpdrn.supabase.co/functions/v1/piverify-create-session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Fixes Applied

### 1. Authentication Fix
- Updated from deprecated `getClaims()` to standard `getUser()` method
- Ensures reliable user authentication

### 2. Environment Variable Validation
- Added comprehensive checks for all required environment variables
- Provides clear error messages when variables are missing

### 3. Enhanced Error Handling & Logging
- Added console logging for all critical operations
- Improved error messages for debugging
- Added try-catch blocks around entire function bodies

### 4. Webhook Signature Verification
- Enhanced signature verification with constant-time comparison
- Added explicit checks for missing signature headers
- Improved error messages for signature validation failures

### 5. Supabase Configuration
- Added function configuration to disable JWT verification
- Prevents conflicts with Supabase's JWT middleware

## Files Modified

1. `.env.example` - Added PiVerify environment variables with API key
2. `supabase/config.toml` - Added function configuration
3. `supabase/functions/piverify-create-session/index.ts` - Fixed auth, added logging, improved error handling
4. `supabase/functions/piverify-webhook/index.ts` - Enhanced signature verification, added logging, improved error handling

## Security Considerations

### API Key Security
- ✅ API key is stored in environment variables (not in code)
- ✅ API key is never exposed to the frontend
- ✅ Using sandbox key for development (no billing impact)

### Webhook Security
- ✅ Signature verification implemented
- ✅ Constant-time comparison prevents timing attacks
- ✅ Webhook secret should be kept secure

### Database Security
- ✅ Row Level Security enabled on `piverify_sessions`
- ✅ Users can only read their own sessions
- ✅ Service role required for webhook updates

## Troubleshooting

### Common Issues

1. **"PiVerify not configured" error**
   - Ensure `PIVERIFY_API_KEY` is set in Supabase Edge Functions settings
   - Check the Supabase dashboard → Settings → Edge Functions

2. **"Invalid signature" webhook error**
   - Ensure `PIVERIFY_WEBHOOK_SECRET` matches the secret in PiVerify portal
   - Verify the webhook URL is correct in PiVerify portal

3. **Session not being created**
   - Check Supabase function logs for detailed error messages
   - Verify the API key is valid and active
   - Ensure the user is authenticated

4. **Webhook not updating database**
   - Check that webhook is configured in PiVerify portal
   - Verify the webhook URL is accessible
   - Check Supabase function logs for webhook processing

### Debugging

1. **Check Supabase Function Logs**:
   - Navigate to Supabase dashboard → Edge Functions → Logs
   - Look for console.log messages added in the fixes

2. **Test Webhook Locally**:
   - Use ngrok to expose local endpoint for testing
   - Test webhook signature verification locally

3. **Verify Database**:
   - Check `piverify_sessions` table for session records
   - Verify RLS policies are working correctly

## Production Deployment

When moving to production:

1. **Get Production API Key**:
   - Contact PiVerify team to activate production access
   - Replace sandbox key with production key

2. **Update Environment Variables**:
   - Update `PIVERIFY_API_KEY` to production key
   - Keep `PIVERIFY_WEBHOOK_SECRET` secure

3. **Test in Production**:
   - Run a test verification with production credentials
   - Verify webhook delivery and processing
   - Check billing and credits

4. **Monitor**:
   - Set up monitoring for edge function errors
   - Track verification success rates
   - Monitor webhook delivery failures

## Support

For issues with:
- **PiVerify API**: Contact PiVerify support via their portal
- **Supabase Functions**: Check Supabase documentation
- **Integration**: Review the code comments and logs