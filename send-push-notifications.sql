-- ============================================================
-- Send Push Notifications Edge Function
-- Deploy this as a Supabase Edge Function
-- ============================================================

-- Edge Function: send-push-notifications/index.ts
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import webpush from 'https://esm.sh/web-push@3.6.6'

interface PushNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  data: any;
}

serve(async (req) => {
  try {
    // Get VAPID credentials from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new Error('Missing VAPID credentials')
    }

    // Set VAPID details
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    )

    // Get pending push notifications from outbox
    const { data: notifications, error: fetchError } = await supabase
      .from('push_notifications_outbox')
      .select('*')
      .eq('status', 'pending')
      .lte('attempts', 3) // Max 3 attempts
      .order('created_at', { ascending: true })
      .limit(100) // Batch size

    if (fetchError) throw fetchError

    const results = []

    for (const notification of notifications) {
      try {
        // Get user's push subscriptions
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', notification.user_id)

        if (!subscriptions || subscriptions.length === 0) {
          // Mark as failed if no subscriptions
          await supabase
            .from('push_notifications_outbox')
            .update({ 
              status: 'failed', 
              error_message: 'No push subscriptions found',
              last_attempt_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          
          results.push({ id: notification.id, status: 'failed', error: 'No subscriptions' })
          continue
        }

        // Send to all subscriptions for this user
        const pushPromises = subscriptions.map(async (subscription) => {
          const pushPayload = {
            title: notification.title,
            body: notification.message,
            data: notification.data,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            actions: [
              {
                action: 'explore',
                title: 'Open App'
              }
            ]
          }

          return webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key
            }
          }, JSON.stringify(pushPayload))
        })

        await Promise.allSettled(pushPromises)

        // Mark as sent
        await supabase
          .from('push_notifications_outbox')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', notification.id)

        results.push({ id: notification.id, status: 'sent' })

      } catch (error) {
        // Increment attempts and update error
        await supabase
          .from('push_notifications_outbox')
          .update({ 
            attempts: notification.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: error.message,
            status: notification.attempts >= 2 ? 'failed' : 'pending'
          })
          .eq('id', notification.id)

        results.push({ id: notification.id, status: 'error', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: notifications.length,
        results 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Push notification error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
*/

-- ============================================================
-- Instructions for Deployment
-- ============================================================

/*
1. First, generate VAPID keys:
   npm install web-push
   node generate_vapid_keys.js

2. Add the generated keys as Supabase secrets:
   supabase secrets set VAPID_PUBLIC_KEY="your-public-key"
   supabase secrets set VAPID_PRIVATE_KEY="your-private-key"
   supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"

3. Create the edge function:
   supabase functions new send-push-notifications

4. Replace the content of send-push-notifications/index.ts with the code above

5. Install dependencies:
   cd supabase/functions/send-push-notifications
   npm install web-push

6. Deploy the function:
   supabase functions deploy send-push-notifications

7. Set up a cron job to run this function every minute:
   supabase functions invoke send-push-notifications

8. Test the setup:
   - Run the database setup: psql < setup_push_notifications.sql
   - Check that tables exist: \dt push_*
   - Insert a test notification and verify it gets queued and sent
*/
