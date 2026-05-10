export interface PhantomTransaction {
  id: string;
  signature: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  fee?: number;
  note?: string;
  type: 'send' | 'receive';
}

export class TransactionHistoryService {
  private readonly STORAGE_KEY = 'phantom_transaction_history';
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {}

  addTransaction(transaction: Omit<PhantomTransaction, 'id'>): PhantomTransaction {
    const newTransaction: PhantomTransaction = {
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'pending',
      blockNumber: undefined,
      fee: undefined,
      ...transaction
    };

    const history = this.getHistory();
    history.unshift(newTransaction);
    
    // Keep only the latest transactions
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(this.MAX_HISTORY_SIZE);
    }

    this.saveHistory(history);
    return newTransaction;
  }

  updateTransactionStatus(signature: string, status: PhantomTransaction['status'], blockNumber?: number): void {
    const history = this.getHistory();
    const transaction = history.find(tx => tx.signature === signature);
    
    if (transaction) {
      transaction.status = status;
      if (blockNumber) {
        transaction.blockNumber = blockNumber;
      }
      
      this.saveHistory(history);
    }
  }

  getHistory(): PhantomTransaction[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to get transaction history:', error);
    }
    return [];
  }

  saveHistory(history: PhantomTransaction[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save transaction history:', error);
    }
  }

  clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear transaction history:', error);
    }
  }

  getTransactionsByType(type: PhantomTransaction['type']): PhantomTransaction[] {
    const history = this.getHistory();
    return history.filter(tx => tx.type === type);
  }

  getTransactionsByStatus(status: PhantomTransaction['status']): PhantomTransaction[] {
    const history = this.getHistory();
    return history.filter(tx => tx.status === status);
  }

  getTransactionsByAddress(address: string): PhantomTransaction[] {
    const history = this.getHistory();
    return history.filter(tx => 
      tx.fromAddress === address || tx.toAddress === address
    );
  }

  getRecentTransactions(limit: number = 10): PhantomTransaction[] {
    const history = this.getHistory();
    return history.slice(0, limit);
  }

  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Analytics methods
  getTotalSent(): number {
    const sentTransactions = this.getTransactionsByType('send');
    return sentTransactions
      .filter(tx => tx.status === 'confirmed')
      .reduce((total, tx) => total + tx.amount, 0);
  }

  getTotalReceived(): number {
    const receivedTransactions = this.getTransactionsByType('receive');
    return receivedTransactions
      .filter(tx => tx.status === 'confirmed')
      .reduce((total, tx) => total + tx.amount, 0);
  }

  getTransactionCount(): { total: number; sent: number; received: number; pending: number; confirmed: number; failed: number } {
    const history = this.getHistory();
    
    return {
      total: history.length,
      sent: history.filter(tx => tx.type === 'send').length,
      received: history.filter(tx => tx.type === 'receive').length,
      pending: history.filter(tx => tx.status === 'pending').length,
      confirmed: history.filter(tx => tx.status === 'confirmed').length,
      failed: history.filter(tx => tx.status === 'failed').length,
    };
  }

  getAverageTransactionAmount(): number {
    const history = this.getHistory();
    const confirmedTransactions = history.filter(tx => tx.status === 'confirmed');
    
    if (confirmedTransactions.length === 0) return 0;
    
    const total = confirmedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    return total / confirmedTransactions.length;
  }
}

// Singleton instance
export const transactionHistory = new TransactionHistoryService();
