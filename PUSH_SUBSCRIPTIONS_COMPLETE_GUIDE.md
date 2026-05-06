# Push Notification Subscription System - Complete Fix

This guide provides a complete solution for the `relation "public.push_subscriptions" does not exist` error.

## Problem
The push notification system was failing because the `push_subscriptions` table was missing from the database, causing the error:
```
relation "public.push_subscriptions" does not exist
```

## Solution Overview
We've created a comprehensive push notification subscription system with:

1. **Database Migration**: Complete table creation with proper schema
2. **Backend API**: Supabase Edge Functions for subscription management
3. **Frontend Service**: TypeScript service for easy integration
4. **React Hook**: Custom hook for seamless UI integration

## Files Created

### Database Layer
- `supabase/migrations/20260507022045_create_push_subscriptions_table.sql` - Main migration
- `deploy_push_subscriptions_fix.sql` - Quick deployment script

### Backend API
- `supabase/functions/push-subscriptions/index.ts` - Edge Function for subscription management

### Frontend Integration
- `src/services/pushSubscriptionService.ts` - Service layer for API calls
- `src/hooks/usePushSubscription.ts` - React hook for component integration

## Table Schema

The `push_subscriptions` table includes all required fields:

```sql
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Deployment Instructions

### Step 1: Deploy Database Changes

Run the deployment script in Supabase SQL Editor:

```sql
-- Copy contents from deploy_push_subscriptions_fix.sql
-- Execute in Supabase SQL Editor
```

### Step 2: Deploy Edge Function

```bash
# Deploy the push-subscriptions function
supabase functions deploy push-subscriptions

# Set environment variables if needed
supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
```

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

## Usage Examples

### Basic Subscription Management

```tsx
import { usePushSubscription } from '@/hooks/usePushSubscription';

function PushNotificationToggle() {
  const { isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushSubscription();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div>
      <button 
        onClick={handleToggle} 
        disabled={isLoading}
      >
        {isSubscribed ? 'Unsubscribe' : 'Subscribe'} to Push Notifications
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

### Advanced Usage with Service

```tsx
import { pushSubscriptionService } from '@/services/pushSubscriptionService';

async function manageSubscriptions() {
  // Subscribe to push notifications
  const subscribeResult = await pushSubscriptionService.subscribeToPushNotifications();
  
  // Check subscription status
  const isSubscribed = await pushSubscriptionService.isSubscribed();
  
  // Get all user subscriptions
  const subscriptions = await pushSubscriptionService.getUserSubscriptions();
  
  // Unsubscribe
  const unsubscribeResult = await pushSubscriptionService.unsubscribeFromPushNotifications();
}
```

## API Endpoints

### Save Subscription
```
POST /functions/v1/push-subscriptions/save
Content-Type: application/json
Authorization: Bearer <token>

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "p256dh": "base64_encoded_key",
  "auth": "base64_encoded_auth",
  "device": "Desktop - Chrome"
}
```

### Delete Subscription
```
DELETE /functions/v1/push-subscriptions/delete
Content-Type: application/json
Authorization: Bearer <token>

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### Get User Subscriptions
```
GET /functions/v1/push-subscriptions/subscriptions
Authorization: Bearer <token>
```

### Check Subscription
```
POST /functions/v1/push-subscriptions/check
Content-Type: application/json
Authorization: Bearer <token>

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

## Security Features

- **Row Level Security (RLS)**: Users can only access their own subscriptions
- **Input Validation**: All inputs are validated before processing
- **Error Handling**: Comprehensive error handling with clear messages
- **Authentication**: All endpoints require valid JWT tokens

## Testing

### Test Database Connection

```sql
-- Verify table exists
SELECT COUNT(*) FROM public.push_subscriptions;

-- Test helper functions
SELECT * FROM public.get_user_push_subscriptions('your-user-id');
```

### Test API Endpoints

```bash
# Test subscription save
curl -X POST "https://your-project.supabase.co/functions/v1/push-subscriptions/save" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://test-endpoint.com",
    "p256dh": "test-key",
    "auth": "test-auth"
  }'
```

## Troubleshooting

### Common Issues

1. **Table doesn't exist after migration**
   - Run the deployment script again
   - Check Supabase migration status

2. **Permission denied errors**
   - Ensure RLS policies are correctly applied
   - Verify user authentication

3. **VAPID key errors**
   - Generate new VAPID keys: `node generate_vapid_keys.js`
   - Update environment variables

4. **Service Worker issues**
   - Ensure `/public/notifications-sw.js` exists
   - Check service worker registration

### Debug Queries

```sql
-- Check table structure
\d public.push_subscriptions

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'push_subscriptions';

-- Check function permissions
SELECT proname, proacl FROM pg_proc WHERE proname LIKE '%push_subscription%';
```

## Integration with Existing System

The push notification system integrates seamlessly with the existing notification infrastructure:

- Uses existing `auth.users` for user management
- Works with existing `notification_preferences` table
- Compatible with existing real-time notification system
- Maintains the same security model as other OpenPay features

## Performance Considerations

- **Indexes**: Created on `user_id` and `endpoint` for fast lookups
- **Real-time**: Table is included in `supabase_realtime` publication
- **Cleanup**: Consider adding a cleanup job for old subscriptions
- **Monitoring**: Track subscription success/failure rates

## Next Steps

1. **Generate VAPID Keys**: Run `node generate_vapid_keys.js`
2. **Deploy Database Changes**: Execute the migration script
3. **Deploy Edge Function**: Use Supabase CLI to deploy
4. **Test Integration**: Verify subscription flow works
5. **Monitor Performance**: Set up monitoring for push notifications

This complete solution ensures that push notification subscriptions work correctly without the `relation "public.push_subscriptions" does not exist` error.
