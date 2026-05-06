import { supabase } from "@/integrations/supabase/client";

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  device?: string;
}

export interface SubscriptionResponse {
  success: boolean;
  message?: string;
  subscription_id?: string;
  error?: string;
}

export interface SubscriptionsListResponse {
  success: boolean;
  subscriptions?: Array<{
    id: string;
    endpoint: string;
    device?: string;
    created_at: string;
  }>;
  error?: string;
}

export interface CheckSubscriptionResponse {
  success: boolean;
  exists: boolean;
  subscription?: {
    id: string;
    user_id: string;
    device?: string;
    created_at: string;
  };
  error?: string;
}

class PushSubscriptionService {
  private readonly FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-subscriptions`;

  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  }

  /**
   * Save a push subscription
   * Creates new subscription or updates existing one
   */
  async saveSubscription(subscription: PushSubscription): Promise<SubscriptionResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.FUNCTION_URL}/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(subscription),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error saving push subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Delete a push subscription
   */
  async deleteSubscription(endpoint: string): Promise<SubscriptionResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.FUNCTION_URL}/delete`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ endpoint }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting push subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get all push subscriptions for the current user
   */
  async getUserSubscriptions(): Promise<SubscriptionsListResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.FUNCTION_URL}/subscriptions`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting push subscriptions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if a subscription already exists
   */
  async checkSubscription(endpoint: string): Promise<CheckSubscriptionResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.FUNCTION_URL}/check`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking push subscription:', error);
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Subscribe to push notifications using the Web Push API
   * This method handles the browser permission flow and subscription creation
   */
  async subscribeToPushNotifications(): Promise<SubscriptionResponse> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return {
          success: false,
          error: 'Push notifications are not supported in this browser',
        };
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          error: 'Push notification permission denied',
        };
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/notifications-sw.js');
      console.log('Service Worker registered:', registration);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || ''),
      });

      // Convert subscription to our format
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        device: this.getDeviceInfo(),
      };

      // Save subscription to database
      return await this.saveSubscription(pushSubscription);
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<SubscriptionResponse> {
    try {
      if (!('serviceWorker' in navigator)) {
        return {
          success: false,
          error: 'Service Worker not supported',
        };
      }

      const registration = await navigator.serviceWorker.getRegistration('/notifications-sw.js');
      if (!registration) {
        return {
          success: false,
          error: 'No Service Worker registration found',
        };
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        return {
          success: false,
          error: 'No push subscription found',
        };
      }

      // Delete from database first
      const deleteResult = await this.deleteSubscription(subscription.endpoint);
      if (!deleteResult.success) {
        return deleteResult;
      }

      // Unsubscribe from browser
      const unsubscribeResult = await subscription.unsubscribe();
      if (!unsubscribeResult) {
        return {
          success: false,
          error: 'Failed to unsubscribe from browser',
        };
      }

      return {
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      };
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if user is currently subscribed to push notifications
   */
  async isSubscribed(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator)) {
        return false;
      }

      const registration = await navigator.serviceWorker.getRegistration('/notifications-sw.js');
      if (!registration) {
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  // Helper methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    let deviceType = 'Unknown';
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceType = /iPad/.test(userAgent) ? 'Tablet' : 'Mobile';
    } else if (/Desktop/.test(userAgent)) {
      deviceType = 'Desktop';
    }

    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return `${deviceType} - ${browser}`;
  }
}

export const pushSubscriptionService = new PushSubscriptionService();
