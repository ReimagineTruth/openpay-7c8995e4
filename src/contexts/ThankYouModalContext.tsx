import { createContext, useContext, useState, ReactNode } from 'react';
import { type ThankYouModalData } from '@/components/ThankYouModal';

interface ThankYouModalContextType {
  showThankYouModal: (data: ThankYouModalData) => void;
  thankYouOpen: boolean;
  thankYouData: ThankYouModalData | null;
  setThankYouOpen: (open: boolean) => void;
}

const ThankYouModalContext = createContext<ThankYouModalContextType | undefined>(undefined);

export const useThankYouModal = () => {
  const context = useContext(ThankYouModalContext);
  if (!context) {
    throw new Error('useThankYouModal must be used within a ThankYouModalProvider');
  }
  return context;
};

interface ThankYouModalProviderProps {
  children: ReactNode;
}

export const ThankYouModalProvider = ({ children }: ThankYouModalProviderProps) => {
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [thankYouData, setThankYouData] = useState<ThankYouModalData | null>(null);

  const showThankYouModal = (data: ThankYouModalData) => {
    setThankYouData(data);
    setThankYouOpen(true);
  };

  return (
    <ThankYouModalContext.Provider
      value={{
        showThankYouModal,
        thankYouOpen,
        thankYouData,
        setThankYouOpen,
      }}
    >
      {children}
    </ThankYouModalContext.Provider>
  );
};
