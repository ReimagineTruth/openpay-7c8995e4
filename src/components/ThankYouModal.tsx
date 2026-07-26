import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, Heart, Download } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ThankYouModalData {
  receiverName: string;
  receiverUsername?: string;
  amount: number;
  purpose?: string;
  note?: string;
  receiverAvatar?: string;
  transactionId?: string;
  date?: Date;
}

interface ThankYouModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ThankYouModalData | null;
  onViewReceipt?: () => void;
}

const ThankYouModal = ({ open, onOpenChange, data, onViewReceipt }: ThankYouModalProps) => {
  const { format: formatCurrency } = useCurrency();

  if (!data) return null;

  const getPurposeIcon = (purpose?: string) => {
    if (!purpose) return null;
    
    const iconMap: { [key: string]: string } = {
      'rent': '🏠',
      'car payment': '🚗',
      'groceries': '🛒',
      'restaurant': '🍽️',
      'gas/fuel': '⛽',
      'electricity': '💡',
      'water': '💧',
      'internet': '📶',
      'phone': '📱',
      'insurance': '🛡️',
      'subscription': '💳',
      'general': '⋯'
    };
    
    return iconMap[purpose.toLowerCase()] || '💝';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Thank You</DialogTitle>
        <DialogDescription className="sr-only">Thank you message for successful payment</DialogDescription>

        <div className="bg-gradient-to-br from-paypal-blue to-[#0073e6] p-6 text-center text-white">
          <div className="relative">
            <CheckCircle className="mx-auto h-16 w-16 mb-3 animate-pulse" />
            <Heart className="absolute top-0 right-1/4 h-6 w-6 text-pink-300 animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Thank You!</h2>
          <p className="text-sm opacity-90">Payment sent successfully</p>
        </div>

        <div className="p-5 space-y-3">
          {/* Receiver Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold overflow-hidden">
              {data.receiverAvatar ? (
                <img
                  src={data.receiverAvatar}
                  alt={data.receiverName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                data.receiverName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{data.receiverName}</p>
              {data.receiverUsername && (
                <p className="text-sm text-gray-500 truncate">@{data.receiverUsername}</p>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="text-center py-1">
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(data.amount)}</p>
          </div>

          {/* Purpose */}
          {data.purpose && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl min-w-0">
              <span className="text-2xl shrink-0">{getPurposeIcon(data.purpose)}</span>
              <div className="min-w-0">
                <p className="text-xs text-blue-600 font-medium">Purpose</p>
                <p className="font-semibold text-blue-900 capitalize truncate">{data.purpose}</p>
              </div>
            </div>
          )}

          {/* Note */}
          {data.note && (
            <div className="p-3 bg-amber-50 rounded-xl min-w-0">
              <p className="text-xs text-amber-600 font-medium mb-1">Note</p>
              <p className="text-xs text-amber-900 font-mono [overflow-wrap:anywhere] break-all line-clamp-2">
                {data.note}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            {onViewReceipt && (
              <Button
                onClick={() => {
                  onViewReceipt();
                  onOpenChange(false);
                }}
                variant="outline"
                className="flex-1 rounded-full border-paypal-blue text-paypal-blue hover:bg-paypal-blue/10 font-medium"
              >
                <Download className="mr-2 h-4 w-4" />
                View Receipt
              </Button>
            )}
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-full bg-gradient-to-r from-paypal-blue to-[#0073e6] text-white font-medium hover:bg-[#004dc5]"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { ThankYouModalData };
export default ThankYouModal;
