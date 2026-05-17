import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X, ArrowRight, ArrowLeft, Sparkles, Wallet, Send, Users, QrCode, Menu, PiggyBank, CreditCard, TrendingUp, ShieldCheck, HandCoins, Clock, CheckCircle } from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  content: string;
  icon: React.ElementType;
  action?: () => void;
}

const OpenPayTutorial = ({ isOpen, onClose, onComplete }: { isOpen: boolean; onClose: () => void; onComplete?: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps: TutorialStep[] = [
    {
      id: "welcome",
      title: "Welcome to OpenPay! 🎉",
      description: "Your complete Pi Network financial hub",
      content: "Let's take a quick tour to help you master OpenPay's powerful features. This will only take a few minutes!",
      icon: Sparkles,
      action: () => {
        // Welcome step
      }
    },
    {
      id: "balance",
      title: "Your Balance 💰",
      description: "View your available funds",
      content: "This is your main wallet balance. You can tap the eye icon to show/hide your balance for privacy. Your balance displays in real-time with beautiful animations!",
      icon: Wallet,
      action: () => {
        // Balance step
      }
    },
    {
      id: "sections",
      title: "Navigation Sections 📱",
      description: "Explore different areas",
      content: "Use these tabs to switch between Wallet, Savings, Credit, Cards, and Buy sections. Each section offers unique financial tools!",
      icon: Menu,
      action: () => {
        // Navigation sections step
      }
    },
    {
      id: "transactions",
      title: "Recent Activity 📊",
      description: "Track your transactions",
      content: "View your latest transactions here. Tap any transaction to see detailed receipt information. Transactions are color-coded: blue for received, red for sent, green for top-ups!",
      icon: Clock,
      action: () => {
        // Recent activity step
      }
    },
    {
      id: "pay-button",
      title: "Send Money 💸",
      description: "Quick payment access",
      content: "Use the Pay button to send money instantly. You can send to contacts, scan QR codes, or enter wallet addresses directly!",
      icon: Send,
      action: () => {
        // Pay button step
      }
    },
    {
      id: "receive-button",
      title: "Receive Money 📥",
      description: "Get paid easily",
      content: "Click Receive to show your QR code or get your wallet address. Perfect for receiving payments from others!",
      icon: QrCode,
      action: () => {
        // Receive button step
      }
    },
    {
      id: "buy-button",
      title: "Buy OpenUSD 💎",
      description: "Add funds to your account",
      content: "Purchase OpenUSD using various payment methods including Pi, USDT, USDC, and more. Great rates and instant processing!",
      icon: CreditCard,
      action: () => {
        // Buy button step
      }
    },
    {
      id: "savings",
      title: "Smart Savings 🏦",
      description: "Grow your money",
      content: "Move funds to savings to earn interest. Your savings work for you with competitive APY rates. Transfer between wallet and savings anytime!",
      icon: PiggyBank,
      action: () => {
        // Savings step
      }
    },
    {
      id: "credit",
      title: "Credit & Loans 🏦",
      description: "Access credit when needed",
      content: "Check your credit score and apply for loans. Build your credit history with responsible borrowing and on-time payments!",
      icon: TrendingUp,
      action: () => {
        // Credit step
      }
    },
    {
      id: "security",
      title: "Security First 🔒",
      description: "Your money is safe",
      content: "OpenPay uses bank-level security with PIN protection, encrypted transactions, and secure storage. Your financial data is always protected! The app also supports dark mode for comfortable viewing in any lighting condition.",
      icon: ShieldCheck,
      action: () => {
        // Security step
      }
    },
    {
      id: "success",
      title: "You're All Set! 🎯",
      description: "Tutorial complete",
      content: "Congratulations! You now know how to use OpenPay like a pro. Start exploring all the features and enjoy seamless Pi Network transactions!",
      icon: CheckCircle,
      action: () => {
        // Completion step
        onComplete?.();
      }
    }
  ];

  // Spotlight functionality removed

  const currentStepData = tutorialSteps[currentStep];
  const Icon = currentStepData.icon;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      currentStepData.action?.();
    } else {
      onClose();
      onComplete?.();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
    onComplete?.();
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    // Add CSS for tutorial animations
    const style = document.createElement('style');
    style.textContent = `
      .tutorial-float {
        animation: float 3s ease-in-out infinite;
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent showCloseButton={false} className="max-w-md rounded-3xl p-0 overflow-hidden bg-white shadow-2xl border border-gray-200">
          <DialogTitle className="sr-only">OpenPay Tutorial</DialogTitle>
          <DialogDescription className="sr-only">Interactive step-by-step guide to use OpenPay features</DialogDescription>
          
          {/* Header */}
          <div className="bg-gradient-to-br from-paypal-blue via-blue-600 to-[#0073e6] p-6 text-center text-white relative overflow-hidden">
            {/* Animated background particles */}
            <div className="absolute inset-0">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute h-1 w-1 rounded-full bg-white/30 animate-float"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${5 + Math.random() * 3}s`
                  }}
                />
              ))}
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
              <Icon className="relative mx-auto h-12 w-12 mb-3 animate-float drop-shadow-2xl" />
              <h2 className="text-xl font-bold animate-fadeInUp">{currentStepData.title}</h2>
              <p className="text-sm text-white/90 mt-1 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                {currentStepData.description}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 bg-white">
            <div className="mb-6">
              <p className="text-gray-800 leading-relaxed animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
                {currentStepData.content}
              </p>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>Step {currentStep + 1} of {tutorialSteps.length}</span>
                <span>{Math.round(((currentStep + 1) / tutorialSteps.length) * 100)}% Complete</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-paypal-blue to-blue-600 rounded-full transition-all duration-500 animate-shimmer"
                  style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handlePrevious}
                  className="flex-1 rounded-full hover-lift"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
              )}
              
              {currentStep < tutorialSteps.length - 1 ? (
                <Button 
                  onClick={handleNext}
                  className="flex-1 rounded-full bg-paypal-blue text-white btn-glow btn-press hover-lift-enhanced"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={handleNext}
                  className="flex-1 rounded-full bg-green-500 text-white btn-glow btn-press hover-lift-enhanced"
                >
                  Get Started
                  <CheckCircle className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Skip button */}
            {currentStep < tutorialSteps.length - 1 && (
              <button
                onClick={handleSkip}
                className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip Tutorial
              </button>
            )}
          </div>

          {/* Tutorial icon */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-white/80 animate-fadeInUp">Tutorial</span>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OpenPayTutorial;
