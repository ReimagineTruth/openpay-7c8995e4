import { useThankYouModal } from '@/contexts/ThankYouModalContext';
import ThankYouModal from './ThankYouModal';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TransactionReceipt, { type ReceiptData } from './TransactionReceipt';

const GlobalThankYouModal = () => {
  const { thankYouOpen, thankYouData, setThankYouOpen } = useThankYouModal();
  const navigate = useNavigate();
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const handleViewReceipt = () => {
    if (thankYouData?.transactionId && thankYouData?.date) {
      setReceiptData({
        transactionId: thankYouData.transactionId,
        ledgerTransactionId: thankYouData.transactionId,
        type: "send",
        amount: thankYouData.amount,
        otherPartyName: thankYouData.receiverName,
        otherPartyUsername: thankYouData.receiverUsername,
        note: thankYouData.note,
        date: thankYouData.date,
      });
      setShowReceipt(true);
    }
  };

  const handleThankYouClose = (open: boolean) => {
    setThankYouOpen(open);
    if (!open) {
      // For receivers, just navigate to dashboard
      // For senders, the receipt is handled by the SendMoney component
      if (!showReceipt) {
        navigate('/dashboard');
      }
    }
  };

  return (
    <>
      <ThankYouModal
        open={thankYouOpen}
        onOpenChange={handleThankYouClose}
        data={thankYouData}
        onViewReceipt={thankYouData?.transactionId ? handleViewReceipt : undefined}
      />
      {showReceipt && receiptData && (
        <TransactionReceipt
          open={showReceipt}
          onOpenChange={(open) => {
            setShowReceipt(open);
            if (!open) navigate('/dashboard');
          }}
          receipt={receiptData}
        />
      )}
    </>
  );
};

export default GlobalThankYouModal;
