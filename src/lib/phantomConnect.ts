import { BrowserSDK, AddressType } from "@phantom/browser-sdk";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { transactionHistory, PhantomTransaction } from './transactionHistory';

export interface PhantomWalletState {
  isConnected: boolean;
  addresses: string[];
  solanaAddress: string | null;
  balance: number | null;
  sdk: BrowserSDK | null;
}

export interface TransactionOptions {
  recipient: string;
  amount: number; // in SOL
  reference?: string;
}

export class PhantomConnectService {
  private sdk: BrowserSDK | null = null;
  private connection: Connection | null = null;
  private readonly APP_ID = "872ec39f-b219-40d1-9559-726deca51695";
  private readonly REDIRECT_URL = `${window.location.origin}/auth/callback`;
  private readonly STORAGE_KEY = 'phantom_connect_session';

  constructor() {
    this.initializeConnection();
  }

  private initializeConnection() {
    const rpcUrl = 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async initialize(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        console.warn('Phantom Connect is only available in browser environment');
        return false;
      }

      // Check for existing session in localStorage
      const savedSession = this.getStoredSession();
      if (savedSession) {
        console.log('Found saved Phantom Connect session, attempting to restore...');
      }

      this.sdk = new BrowserSDK({
        providers: ["phantom"],
        addressTypes: [AddressType.solana, AddressType.sui],
        appId: this.APP_ID,
        authOptions: {
          authUrl: "https://connect.phantom.app/login",
          redirectUrl: this.REDIRECT_URL,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize Phantom Connect SDK:', error);
      return false;
    }
  }

  async getWalletState(): Promise<PhantomWalletState> {
    if (!this.sdk) {
      return {
        isConnected: false,
        addresses: [],
        solanaAddress: null,
        balance: null,
        sdk: null
      };
    }

    try {
      // Check if already connected by trying to get addresses
      let addresses: string[] = [];
      let solanaAddress: string | null = null;
      let balance: number | null = null;

      try {
        const result = await this.sdk.connect({ provider: 'phantom' });
        addresses = result.addresses?.map(addr => addr.address) || [];
        solanaAddress = addresses.find(addr => addr.startsWith('0x')) || null;
        
        if (solanaAddress && this.connection) {
          const publicKey = new PublicKey(solanaAddress);
          const balanceLamports = await this.connection.getBalance(publicKey);
          balance = balanceLamports / LAMPORTS_PER_SOL;
        }

      // Save session to localStorage
        if (addresses.length > 0) {
          this.saveSession({
            addresses,
            solanaAddress,
            connected: true,
            timestamp: Date.now()
          });
        }
        
        // Add transaction to history if this is a new connection
        const existingTransactions = transactionHistory.getTransactionsByAddress(solanaAddress || '');
        if (existingTransactions.length === 0) {
          transactionHistory.addTransaction({
            type: 'receive',
            fromAddress: 'system',
            toAddress: solanaAddress || '',
            amount: 0,
            note: 'Wallet connected',
            signature: '',
            status: 'confirmed',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        // Not connected or connection failed
        console.log('Wallet not connected:', error);
        
        // Try to restore from localStorage
        const savedSession = this.getStoredSession();
        if (savedSession && savedSession.connected) {
          addresses = savedSession.addresses || [];
          solanaAddress = savedSession.solanaAddress;
        }
      }

      return {
        isConnected: addresses.length > 0,
        addresses,
        solanaAddress,
        balance,
        sdk: this.sdk
      };
    } catch (error) {
      console.error('Failed to get wallet state:', error);
      return {
        isConnected: false,
        addresses: [],
        solanaAddress: null,
        balance: null,
        sdk: null
      };
    }
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.sdk) {
        const initialized = await this.initialize();
        if (!initialized) return false;
      }

      const result = await this.sdk.connect({ provider: 'phantom' });
      return (result.addresses?.length || 0) > 0;
    } catch (error) {
      console.error('Failed to connect to Phantom Connect:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.sdk) {
        // Clear session from localStorage
        this.clearSession();
        
        // Phantom Connect SDK doesn't have a direct disconnect method
        // We'll clear local state
        this.sdk = null;
      }
    } catch (error) {
      console.error('Failed to disconnect from Phantom Connect:', error);
    }
  }

  async sendTransaction(options: TransactionOptions): Promise<string | null> {
    try {
      if (!this.sdk || !this.connection) {
        throw new Error('SDK not initialized or connection not available');
      }

      const walletState = await this.getWalletState();
      if (!walletState.solanaAddress) {
        throw new Error('No Solana address available');
      }

      const fromPublicKey = new PublicKey(walletState.solanaAddress);
      const toPublicKey = new PublicKey(options.recipient);
      const lamports = options.amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromPublicKey,
          toPubkey: toPublicKey,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPublicKey;

      // Serialize transaction for signing
      const serializedTransaction = transaction.serialize();

      // Sign transaction with Phantom Connect
      const signedResult = await this.sdk.solana.signTransaction(serializedTransaction as any);

      // Send transaction
      const signature = Array.isArray(signedResult) ? signedResult : (signedResult as any).signature || signedResult;
      const txSignature = await this.connection.sendRawTransaction(signature);

      // Wait for confirmation
      await this.connection.confirmTransaction(txSignature, 'confirmed');

      // Add to transaction history
      transactionHistory.addTransaction({
        type: 'send',
        fromAddress: walletState.solanaAddress || '',
        toAddress: options.recipient,
        amount: options.amount,
        note: options.reference || 'SOL transfer',
        signature: txSignature,
        status: 'confirmed',
        timestamp: Date.now()
      });

      // Update transaction status
      transactionHistory.updateTransactionStatus(txSignature, 'confirmed');

      return txSignature;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      return null;
    }
  }

  async getBalance(): Promise<number | null> {
    try {
      if (!this.connection) return null;

      const walletState = await this.getWalletState();
      if (!walletState.solanaAddress) return null;

      const publicKey = new PublicKey(walletState.solanaAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return null;
    }
  }

  async signMessage(message: string): Promise<string | null> {
    try {
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }

      const signedResult = await this.sdk.solana.signMessage(message);
      return Array.isArray(signedResult) ? Buffer.from(signedResult).toString('hex') : (signedResult as any).signature || signedResult.toString();
    } catch (error) {
      console.error('Failed to sign message:', error);
      return null;
    }
  }

  isPhantomConnectAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  private saveSession(session: {
    addresses: string[];
    solanaAddress: string | null;
    connected: boolean;
    timestamp: number;
  }): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  private getStoredSession(): {
    addresses: string[];
    solanaAddress: string | null;
    connected: boolean;
    timestamp: number;
  } | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        // Check if session is not too old (24 hours)
        if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
          return session;
        }
      }
    } catch (error) {
      console.error('Failed to get stored session:', error);
    }
    return null;
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getTransactionHistory(): PhantomTransaction[] {
    return transactionHistory.getHistory();
  }

  getTransactionAnalytics(): {
    totalSent: number;
    totalReceived: number;
    averageAmount: number;
    transactionCount: { total: number; sent: number; received: number; pending: number; confirmed: number; failed: number };
  } {
    return {
      totalSent: transactionHistory.getTotalSent(),
      totalReceived: transactionHistory.getTotalReceived(),
      averageAmount: transactionHistory.getAverageTransactionAmount(),
      transactionCount: transactionHistory.getTransactionCount()
    };
  }

  clearTransactionHistory(): void {
    transactionHistory.clearHistory();
  }
}

// Singleton instance
export const phantomConnect = new PhantomConnectService();
