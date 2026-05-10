import { useState, useEffect, useCallback } from 'react';
import { phantomConnect, PhantomWalletState, TransactionOptions } from '../lib/phantomConnect';
import { toast } from 'sonner';

export interface UsePhantomWalletReturn extends Omit<PhantomWalletState, 'addresses'> {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendTransaction: (options: TransactionOptions) => Promise<string | null>;
  refreshBalance: () => Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
  isAvailable: boolean;
  isLoading: boolean;
  addresses: string[];
  getTransactionHistory: () => PhantomTransaction[];
  getTransactionAnalytics: () => {
    totalSent: number;
    totalReceived: number;
    averageAmount: number;
    transactionCount: { total: number; sent: number; received: number; pending: number; confirmed: number; failed: number };
  };
  clearTransactionHistory: () => void;
}

export const usePhantomWallet = (): UsePhantomWalletReturn => {
  const [walletState, setWalletState] = useState<Omit<PhantomWalletState, 'addresses'>>({
    isConnected: false,
    solanaAddress: null,
    balance: null,
    sdk: null,
  });
  const [addresses, setAddresses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable] = useState(() => phantomConnect.isPhantomConnectAvailable());

  const refreshWalletState = useCallback(async () => {
    try {
      const state = await phantomConnect.getWalletState();
      setWalletState({
        isConnected: state.isConnected,
        solanaAddress: state.solanaAddress,
        balance: state.balance,
        sdk: state.sdk,
      });
      setAddresses(state.addresses);
    } catch (error) {
      console.error('Failed to refresh wallet state:', error);
    }
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) {
      toast.error('Phantom Connect is not available in this environment.');
      return false;
    }

    setIsLoading(true);
    try {
      const connected = await phantomConnect.connect();
      if (connected) {
        await refreshWalletState();
        toast.success('Successfully connected to Phantom Connect!');
        return true;
      } else {
        toast.error('Failed to connect to Phantom Connect.');
        return false;
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect to Phantom Connect.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, refreshWalletState]);

  const disconnect = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await phantomConnect.disconnect();
      await refreshWalletState();
      toast.success('Disconnected from Phantom wallet.');
    } catch (error) {
      console.error('Disconnection error:', error);
      toast.error('Failed to disconnect from Phantom wallet.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshWalletState]);

  const sendTransaction = useCallback(async (options: TransactionOptions): Promise<string | null> => {
    if (!walletState.isConnected) {
      toast.error('Please connect your wallet first.');
      return null;
    }

    setIsLoading(true);
    try {
      const signature = await phantomConnect.sendTransaction(options);
      if (signature) {
        toast.success(`Transaction sent successfully! Signature: ${signature.slice(0, 8)}...`);
        await refreshWalletState(); // Refresh balance after transaction
        return signature;
      } else {
        toast.error('Failed to send transaction.');
        return null;
      }
    } catch (error) {
      console.error('Transaction error:', error);
      toast.error('Failed to send transaction.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [walletState.isConnected, refreshWalletState]);

  const refreshBalance = useCallback(async (): Promise<void> => {
    if (!walletState.isConnected) return;

    try {
      const balance = await phantomConnect.getBalance();
      setWalletState(prev => ({ ...prev, balance }));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [walletState.isConnected]);

  const clearTransactionHistory = useCallback(() => {
    phantomConnect.clearTransactionHistory();
    toast.success('Transaction history cleared');
  }, []);

  // Auto-refresh wallet state when connection changes
  useEffect(() => {
    refreshWalletState();
  }, [refreshWalletState]);

  // Set up periodic balance refresh
  useEffect(() => {
    if (!walletState.isConnected) return;

    const interval = setInterval(() => {
      refreshBalance();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [walletState.isConnected, refreshBalance]);

  return {
    ...walletState,
    addresses,
    connect,
    disconnect,
    sendTransaction,
    refreshBalance,
    signMessage,
    getTransactionHistory,
    getTransactionAnalytics,
    clearTransactionHistory,
    isAvailable,
    isLoading,
  };
};
