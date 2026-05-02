import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react';

interface DigitalRateDisplayProps {
  className?: string;
  rates: {
    piToOusd: number;
    usdToOusd: number;
    currencyTag: string;
  };
  onRefresh?: () => void;
  refreshing?: boolean;
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
        return <TrendingUp className="h-3 w-3 text-green-400" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-400" />;
      default:
        return <Activity className="h-3 w-3 text-blue-400" />;
    }
  };

  const getTrendColor = () => {
    switch (currentTrend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div
      className={cn(
        'relative bg-black/20 backdrop-blur-md rounded-xl p-4 border border-white/10',
        'transition-all duration-300 hover:scale-105 hover-lift hover:bg-black/30',
        'group cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white/70">{from}</span>
            <span className="text-xs text-white/50">→</span>
            <span className="text-xs font-bold text-white/70">{to}</span>
          </div>
          <div className={cn('flex items-center transition-colors duration-300', getTrendColor())}>
            {getTrendIcon()}
          </div>
        </div>
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">
          1 {from} =
        </span>
        <DigitalNumber
          value={currentRate.toFixed(4)}
          className="text-2xl text-cyan-400"
        />
        <span className="text-lg text-white/70">{to}</span>
      </div>

      {/* Digital effect overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Scanning line effect */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent -skew-x-12 animate-shimmer" />
      </div>
    </div>
  );
};

export const DigitalRateDisplay: React.FC<DigitalRateDisplayProps> = ({
  className,
  rates,
  onRefresh,
  refreshing = false
}) => {
  const [previousRates, setPreviousRates] = useState(rates);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (previousRates.piToOusd !== rates.piToOusd || previousRates.usdToOusd !== rates.usdToOusd) {
      setPreviousRates(rates);
      setLastUpdate(new Date());
    }
  }, [rates, previousRates]);

  const handleRefresh = () => {
    if (onRefresh && !refreshing) {
      onRefresh();
    }
  };

  return (
    <div
      className={cn(
        'relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl',
        'transition-all duration-500 hover:shadow-3xl hover-lift-enhanced',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <h3 className="text-lg font-bold text-white">Live Rates</h3>
          </div>
          <div className="text-xs text-white/60">
            {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20',
            'transition-all duration-300 hover:bg-white/20 hover:scale-105',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            refreshing && 'animate-spin'
          )}
        >
          <RefreshCw className="h-4 w-4 text-white" />
          <span className="text-xs text-white/80">Refresh</span>
        </button>
      </div>

      {/* Currency Display */}
      <div className="mb-6 p-3 bg-black/20 rounded-xl border border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Display Currency</span>
          <div className="flex items-center gap-2">
            <DigitalNumber
              value={rates.currencyTag}
              className="text-lg font-bold text-cyan-400"
            />
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
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

      {/* Digital Effects */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/50 rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/50 rounded-br-xl" />
        
        {/* Scanning effect on hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent animate-shimmer" />
        )}
      </div>

      {/* Particle effects */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-float opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Compact version for smaller spaces
export const CompactDigitalRateDisplay: React.FC<{
  rates: { piToOusd: number; usdToOusd: number };
  className?: string;
}> = ({ rates, className }) => {
  return (
    <div
      className={cn(
        'bg-black/20 backdrop-blur-md rounded-xl p-3 border border-white/10',
        'transition-all duration-300 hover:bg-black/30 hover-lift',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-white/70">Rates</span>
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-white/60">1 PI</span>
            <DigitalNumber value={rates.piToOusd.toFixed(2)} className="text-cyan-400" />
            <span className="text-white/60">OUSD</span>
          </div>
          
          <div className="w-px h-3 bg-white/20" />
          
          <div className="flex items-center gap-1">
            <span className="text-white/60">1 USD</span>
            <DigitalNumber value={rates.usdToOusd.toFixed(2)} className="text-cyan-400" />
            <span className="text-white/60">OUSD</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalRateDisplay;
