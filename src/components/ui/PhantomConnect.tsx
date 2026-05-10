import React, { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Separator } from './separator';
import { Input } from './input';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { usePhantomWallet } from '../../hooks/usePhantomWallet';
import { Copy, Wallet, ExternalLink, RefreshCw, Send, PenTool, AlertCircle } from 'lucide-react';

export interface PhantomConnectProps {
  className?: string;
  showBalance?: boolean;
  showTransactions?: boolean;
  compact?: boolean;
}

export const PhantomConnect: React.FC<PhantomConnectProps> = ({
  className,
  showBalance = true,
  showTransactions = true,
  compact = false
}) => {
  const {
    isConnected,
    solanaAddress,
    balance,
    connect,
    disconnect,
    sendTransaction,
    signMessage,
    isAvailable,
    isLoading,
    addresses
  } = usePhantomWallet();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);

  const handleSendTransaction = async () => {
    if (!recipient || !amount) {
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    await sendTransaction({
      recipient: recipient.trim(),
      amount: amountNum
    });

    setRecipient('');
    setAmount('');
    setShowTransactionForm(false);
  };

  const handleSignMessage = async () => {
    if (!message.trim()) return;

    await signMessage(message.trim());
    setMessage('');
    setShowMessageForm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return '0.00';
    return balance.toFixed(4);
  };

  if (!isAvailable) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Phantom Connect Not Available
          </CardTitle>
          <CardDescription>
            Phantom Connect is required to use Solana features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Phantom Connect is not available in this environment.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={className}>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {solanaAddress && formatAddress(solanaAddress)}
            </Badge>
            {showBalance && balance !== null && (
              <Badge variant="outline">
                {formatBalance(balance)} SOL
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={disconnect}
              disabled={isLoading}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={connect}
            disabled={isLoading}
            className="w-full"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Connect Phantom
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Phantom Wallet
        </CardTitle>
        <CardDescription>
          Connect your Phantom wallet to interact with Solana
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Wallet Address</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => solanaAddress && copyToClipboard(solanaAddress)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {solanaAddress && formatAddress(solanaAddress)}
                </Badge>
                <Badge variant="outline">Connected</Badge>
              </div>
            </div>

            {showBalance && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Balance</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-2xl font-bold">
                  {formatBalance(balance)} SOL
                </div>
              </div>
            )}

            <Separator />

            {showTransactions && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTransactionForm(!showTransactionForm)}
                    className="flex-1"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send SOL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMessageForm(!showMessageForm)}
                    className="flex-1"
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Sign Message
                  </Button>
                </div>

                {showTransactionForm && (
                  <div className="space-y-3 p-3 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Recipient Address</Label>
                      <Input
                        id="recipient"
                        placeholder="Enter Solana address"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (SOL)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        step="0.000000001"
                        min="0"
                      />
                    </div>
                    <Button
                      onClick={handleSendTransaction}
                      disabled={!recipient || !amount || isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Sending...' : 'Send Transaction'}
                    </Button>
                  </div>
                )}

                {showMessageForm && (
                  <div className="space-y-3 p-3 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="message">Message to Sign</Label>
                      <Input
                        id="message"
                        placeholder="Enter message to sign"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSignMessage}
                      disabled={!message || isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Signing...' : 'Sign Message'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="destructive"
              onClick={disconnect}
              disabled={isLoading}
              className="w-full"
            >
              Disconnect Wallet
            </Button>
          </>
        ) : (
          <Button
            onClick={connect}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <Wallet className="h-5 w-5 mr-2" />
            {isLoading ? 'Connecting...' : 'Connect Phantom Connect'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
