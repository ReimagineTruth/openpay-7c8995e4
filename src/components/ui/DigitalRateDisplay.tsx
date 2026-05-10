import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, ChevronUp, ChevronDown, Scale, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import RegulatoryStatusModal from '@/components/RegulatoryStatusModal';

interface DigitalRateDisplayProps {
  className?: string;
  rates: {
    piToOusd: number;
    usdToOusd: number;
    currencyTag: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  liveRateClosed?: boolean;
}

interface RateCardProps {
  from: string;
  to: string;
  rate: number;
  previousRate?: number;
  trend?: 'up' | 'down' | 'stable';
  className?: string;
}

const DigitalNumber: React.FC<{
  value: string | number;
  className?: string;
  animated?: boolean;
}> = ({ value, className, animated = true }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value && animated) {
      setIsAnimating(true);
      setDisplayValue(value);
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
      
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value, animated]);

  return (
    <span
      className={cn(
        'font-mono font-bold transition-all duration-300',
        isAnimating && 'count-animation',
        className
      )}
    >
      {displayValue}
    </span>
  );
};

const RateCard: React.FC<RateCardProps> = ({
  from,
  to,
  rate,
  previousRate,
  trend = 'stable',
  className
}) => {
  const [currentRate, setCurrentRate] = useState(rate);
  const [currentTrend, setCurrentTrend] = useState(trend);

  useEffect(() => {
    if (previousRate !== undefined && previousRate !== rate) {
      setCurrentTrend(rate > previousRate ? 'up' : rate < previousRate ? 'down' : 'stable');
    }
    setCurrentRate(rate);
  }, [rate, previousRate]);

  const getTrendIcon = () => {
    switch (currentTrend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Activity className="h-3 w-3 text-blue-600" />;
    }
  };

  const getTrendColor = () => {
    switch (currentTrend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div
      className={cn(
        'relative bg-white rounded-xl p-4 border border-gray-200 shadow-sm',
        'transition-all duration-300 hover:scale-105 hover-lift hover:shadow-md',
        'group cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-gray-600">{from}</span>
            <span className="text-xs text-gray-400">→</span>
            <span className="text-xs font-bold text-gray-600">{to}</span>
          </div>
          <div className={cn('flex items-center transition-colors duration-300', getTrendColor())}>
            {getTrendIcon()}
          </div>
        </div>
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-800">
          1 {from} =
        </span>
        <DigitalNumber
          value={currentRate.toFixed(4)}
          className="text-2xl text-blue-600"
        />
        <span className="text-lg text-gray-600">{to}</span>
      </div>

      {/* Subtle hover effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
};

export const DigitalRateDisplay: React.FC<DigitalRateDisplayProps> = ({
  className,
  rates,
  open = true,
  onOpenChange,
  liveRateClosed = false
}) => {
  const [previousRates, setPreviousRates] = useState(rates);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isHovered, setIsHovered] = useState(false);
  const [regulatoryModalOpen, setRegulatoryModalOpen] = useState(false);

  useEffect(() => {
    if (previousRates.piToOusd !== rates.piToOusd || previousRates.usdToOusd !== rates.usdToOusd) {
      setPreviousRates(rates);
      setLastUpdate(new Date());
    }
  }, [rates, previousRates]);


  return (
    <>
      <Collapsible 
        open={open} 
        onOpenChange={onOpenChange}
        className={cn(
          'relative bg-white rounded-2xl p-6 border border-gray-200 shadow-lg',
          'transition-all duration-500 hover:shadow-xl hover-lift-enhanced',
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${liveRateClosed ? 'bg-red-500' : 'bg-green-500'} ${liveRateClosed ? '' : 'animate-pulse'}`} />
            <h3 className="text-lg font-bold text-gray-800">{liveRateClosed ? 'Rates' : 'Live Rates'}</h3>
          </div>
          <div className="text-xs text-gray-500">
            {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Regulatory Status Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRegulatoryModalOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Scale className="h-4 w-4" />
            <span className="text-xs font-medium">Regulatory</span>
            <Info className="h-3 w-3" />
          </Button>
          
          <CollapsibleTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              {open ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </CollapsibleTrigger>
        </div>
      </div>

      {/* Collapsible Content */}
      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        {/* Currency Display */}
        <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Display Currency</span>
            <div className="flex items-center gap-2">
              <DigitalNumber
                value={rates.currencyTag}
                className="text-lg font-bold text-blue-600"
              />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Rate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RateCard
            from="PI"
            to="OUSD"
            rate={rates.piToOusd}
            previousRate={previousRates.piToOusd}
            trend={rates.piToOusd > previousRates.piToOusd ? 'up' : rates.piToOusd < previousRates.piToOusd ? 'down' : 'stable'}
          />
          
          <RateCard
            from="USD"
            to="OUSD"
            rate={rates.usdToOusd}
            previousRate={previousRates.usdToOusd}
            trend={rates.usdToOusd > previousRates.usdToOusd ? 'up' : rates.usdToOusd < previousRates.usdToOusd ? 'down' : 'stable'}
          />
        </div>
      </CollapsibleContent>

      {/* Closed State Message */}
      {!open && (
        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800 font-medium">
              {liveRateClosed ? 
                "Rates temporarily unavailable - Check back later" : 
                "Click to view current exchange rates and market data"
              }
            </span>
          </div>
        </div>
      )}
      </Collapsible>

      {/* Regulatory Status Modal */}
      <RegulatoryStatusModal 
        open={regulatoryModalOpen} 
        onOpenChange={setRegulatoryModalOpen} 
      />
    </>
  );
};

// Compact version for smaller spaces
export const CompactDigitalRateDisplay: React.FC<{
  rates: { piToOusd: number; usdToOusd: number };
  className?: string;
  liveRateClosed?: boolean;
}> = ({ rates, className, liveRateClosed = false }) => {
  const [open, setOpen] = useState(false);
  const [regulatoryModalOpen, setRegulatoryModalOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'bg-white rounded-xl border border-gray-200 shadow-sm',
          'transition-all duration-300 hover:shadow-md hover-lift',
          className
        )}
      >
      {/* Header */}
      <div 
        className="flex items-center justify-between gap-4 p-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${liveRateClosed ? 'bg-red-500' : 'bg-green-500'} ${liveRateClosed ? '' : 'animate-pulse'}`} />
          <span className="text-xs font-semibold text-gray-600">{liveRateClosed ? 'Rates' : 'Live Rates'}</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-gray-600 font-medium">1 PI</span>
            <DigitalNumber value={rates.piToOusd.toFixed(2)} className="text-blue-600 font-bold" />
            <span className="text-gray-600 font-medium">OUSD</span>
          </div>
          
          <div className="w-px h-3 bg-gray-300" />
          
          <div className="flex items-center gap-1">
            <span className="text-gray-600 font-medium">1 USD</span>
            <DigitalNumber value={rates.usdToOusd.toFixed(2)} className="text-blue-600 font-bold" />
            <span className="text-gray-600 font-medium">OUSD</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Regulatory Status Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setRegulatoryModalOpen(true);
            }}
            className="flex items-center gap-1 h-6 px-2 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Scale className="h-3 w-3" />
            <Info className="h-2 w-2" />
          </Button>
          
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-3">
          <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-blue-800 font-medium">
                {liveRateClosed ? 
                  "Rates temporarily unavailable" : 
                  "Real-time exchange rates updated automatically"
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Regulatory Status Modal */}
      <RegulatoryStatusModal 
        open={regulatoryModalOpen} 
        onOpenChange={setRegulatoryModalOpen} 
      />
    </>
  );
};

export default DigitalRateDisplay;
