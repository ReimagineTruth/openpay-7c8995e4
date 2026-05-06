# Mobile Push Notifications Setup Guide

## Overview
This guide will help you set up mobile push notifications for OpenPay using Web Push and VAPID keys.

## Prerequisites
- Supabase project with database access
- Node.js installed
- Database admin access

## Step 1: Database Setup

The database setup script creates the necessary tables for push notifications:

```bash
# Run the database setup
psql YOUR_DATABASE_URL < setup_push_notifications.sql
```

### Tables Created:
- `push_subscriptions` - Stores user push subscription tokens
- `push_notifications_outbox` - Queue for pending push notifications

## Step 2: VAPID Keys

VAPID keys have already been generated:

```
VAPID_PUBLIC_KEY=BMfSLlTze_NKPkK3pYnoWpoiAioiDHhdSCjvpHf8FyLAHBDYBgILrScG6lDtA8bqBqZadK2eYQ6Ct3TQ5zfvY4c
VAPID_PRIVATE_KEY=KyXSbx9WZx6j0zA0Ygtv08hJaFXMs93BUzeqRhkmgjo
VAPID_SUBJECT=mailto:your-email@example.com
```

## Step 3: Set Supabase Secrets

Add these secrets to your Supabase project:

```bash
supabase secrets set VAPID_PUBLIC_KEY="BMfSLlTze_NKPkK3pYnoWpoiAioiDHhdSCjvpHf8FyLAHBDYBgILrScG6lDtA8bqBqZadK2eYQ6Ct3TQ5zfvY4c"
supabase secrets set VAPID_PRIVATE_KEY="KyXSbx9WZx6j0zA0Ygtv08hJaFXMs93BUzeqRhkmgjo"
supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
```

## Step 4: Deploy Edge Function

Create and deploy the push notification sender:

```bash
# Create the edge function
supabase functions new send-push-notifications

# Navigate to the function directory
cd supabase/functions/send-push-notifications

# Create a package.json
echo '{"dependencies": {"web-push": "^3.6.6"}}' > package.json

# Install dependencies
npm install

# Replace index.ts with the edge function code
# (Copy the code from send-push-notifications.sql)

# Deploy the function
cd ../../
supabase functions deploy send-push-notifications
```

## Step 5: Set Up Scheduled Delivery

Create a cron job to process pending push notifications:

```bash
# Test the function manually first
supabase functions invoke send-push-notifications

# Set up a cron job (via your hosting provider or Supabase cron)
# Run every minute to process pending notifications
```

## Step 6: Frontend Integration

Add push notification subscription to your frontend:

```javascript
// Add VAPID public key to your environment
const VAPID_PUBLIC_KEY = 'BMfSLlTze_NKPkK3pYnoWpoiAioiDHhdSCjvpHf8FyLAHBDYBgILrScG6lDtA8bqBqZadK2eYQ6Ct3TQ5zfvY4c';

// Subscribe to push notifications
async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Send subscription to backend
    await savePushSubscription(subscription);
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
  }
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function savePushSubscription(subscription) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      user_agent: navigator.userAgent
    });

  if (error) {
    console.error('Error saving push subscription:', error);
  }
}
```

## Step 7: Service Worker Setup

Create a service worker to handle push notifications:

```javascript
// public/sw.js
self.addEventListener('push', event => {
  const options = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      vibrate: options.vibrate,
      actions: options.actions,
      data: options.data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Handle notification click (open app, navigate to specific page, etc.)
  if (event.action === 'explore') {
    clients.openWindow('/');
  } else {
    clients.openWindow('/');
  }
});
```

## Step 8: Request Permission

Add permission request to your app:

```javascript
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    await subscribeToPushNotifications();
  } else {
    console.log('Notification permission denied');
  }
}

// Call this when user enables push notifications in settings
```

## Testing

1. **Database Test**: Verify tables exist
   ```sql
   \dt push_*
   ```

2. **Subscription Test**: Subscribe a user and verify the subscription is saved
   ```sql
   SELECT * FROM push_subscriptions WHERE user_id = 'your-user-id';
   ```

3. **Notification Test**: Create a test notification and verify it gets queued
   ```sql
   -- This should automatically queue a push notification
   INSERT INTO app_notifications (user_id, title, message, type)
   VALUES ('your-user-id', 'Test', 'This is a test notification', 'info');
   
   -- Check if it was queued
   SELECT * FROM push_notifications_outbox WHERE user_id = 'your-user-id';
   ```

4. **Edge Function Test**: Manually invoke the edge function
   ```bash
   supabase functions invoke send-push-notifications
   ```

## Troubleshooting

### Common Issues:
1. **"relation 'public.push_subscriptions' does not exist"** - Run the database setup script
2. **Push notifications not sending** - Check Supabase secrets are set correctly
3. **Permission denied** - Ensure user has granted notification permission
4. **Service worker not registered** - Make sure service worker is properly registered

### Debug Commands:
```sql
-- Check pending notifications
SELECT COUNT(*) FROM push_notifications_outbox WHERE status = 'pending';

-- Check failed notifications
SELECT * FROM push_notifications_outbox WHERE status = 'failed';

-- Check user subscriptions
SELECT * FROM push_subscriptions WHERE user_id = 'your-user-id';
```

## Security Notes

- VAPID private key should never be exposed to the frontend
- Only the public key should be used in the browser
- Push subscriptions are user-specific and protected by RLS
- Edge function runs with service role privileges

## Next Steps

Once push notifications are working, you can:
- Add notification preferences UI
- Implement quiet hours
- Add notification categories
- Set up analytics for notification engagement
- Add push notification analytics dashboard
