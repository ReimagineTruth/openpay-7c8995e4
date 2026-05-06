import { useState, useEffect, useCallback } from "react";
import { pushSubscriptionService, SubscriptionResponse } from "@/services/pushSubscriptionService";

interface UsePushSubscriptionReturn {
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<SubscriptionResponse>;
  unsubscribe: () => Promise<SubscriptionResponse>;
  checkSubscriptionStatus: () => Promise<void>;
}

export const usePushSubscription = (): UsePushSubscriptionReturn => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const subscribed = await pushSubscriptionService.isSubscribed();
      setIsSubscribed(subscribed);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check subscription status';
      setError(errorMessage);
      console.error('Error checking subscription status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const subscribe = useCallback(async (): Promise<SubscriptionResponse> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await pushSubscriptionService.subscribeToPushNotifications();
      
      if (result.success) {
        setIsSubscribed(true);
      } else {
        setError(result.error || 'Failed to subscribe');
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe';
      setError(errorMessage);
      console.error('Error subscribing:', err);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<SubscriptionResponse> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await pushSubscriptionService.unsubscribeFromPushNotifications();
      
      if (result.success) {
        setIsSubscribed(false);
      } else {
        setError(result.error || 'Failed to unsubscribe');
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe';
      setError(errorMessage);
      console.error('Error unsubscribing:', err);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check subscription status on mount
  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  return {
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus,
  };
};
