import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  lines?: number;
  animated?: boolean;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className,
  width = '100%',
  height = '1rem',
  variant = 'rectangular',
  lines = 1,
  animated = true
}) => {
  const baseClasses = cn(
    'skeleton-enhanced',
    {
      'rounded-full': variant === 'circular',
      'rounded-lg': variant === 'rounded',
      'rounded-none': variant === 'rectangular',
      'animate-shimmer': animated,
    },
    className
  );

  const style = {
    width,
    height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseClasses,
              'h-4',
              index === lines - 1 ? 'w-3/4' : 'w-full'
            )}
            style={{
              ...style,
              animationDelay: `${index * 0.1}s`
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={baseClasses}
      style={style}
    />
  );
};

// Card skeleton component
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('paypal-surface p-4 space-y-3', className)}>
    <LoadingSkeleton variant="circular" width="3rem" height="3rem" />
    <div className="space-y-2">
      <LoadingSkeleton height="1.5rem" width="60%" />
      <LoadingSkeleton height="1rem" width="40%" />
    </div>
  </div>
);

// List skeleton component
export const ListSkeleton: React.FC<{ 
  items?: number; 
  className?: string;
  showAvatar?: boolean;
}> = ({ items = 3, className, showAvatar = true }) => (
  <div className={cn('space-y-4', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3">
        {showAvatar && (
          <LoadingSkeleton variant="circular" width="2.5rem" height="2.5rem" />
        )}
        <div className="flex-1 space-y-2">
          <LoadingSkeleton height="1rem" width="80%" />
          <LoadingSkeleton height="0.75rem" width="60%" />
        </div>
      </div>
    ))}
  </div>
);

// Table skeleton component
export const TableSkeleton: React.FC<{ 
  rows?: number; 
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => (
  <div className={cn('space-y-3', className)}>
    {/* Header */}
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, index) => (
        <LoadingSkeleton key={`header-${index}`} height="1.5rem" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={`row-${rowIndex}`} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <LoadingSkeleton key={`cell-${rowIndex}-${colIndex}`} height="1rem" />
        ))}
      </div>
    ))}
  </div>
);

// Stats skeleton component
export const StatsSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="paypal-surface p-6 space-y-3">
        <LoadingSkeleton height="2rem" width="60%" />
        <LoadingSkeleton height="3rem" width="80%" />
        <LoadingSkeleton height="1rem" width="40%" />
      </div>
    ))}
  </div>
);

// Form skeleton component
export const FormSkeleton: React.FC<{ 
  fields?: number;
  showButton?: boolean;
  className?: string;
}> = ({ fields = 4, showButton = true, className }) => (
  <div className={cn('space-y-4', className)}>
    {Array.from({ length: fields }).map((_, index) => (
      <div key={index} className="space-y-2">
        <LoadingSkeleton height="0.75rem" width="30%" />
        <LoadingSkeleton height="2.5rem" />
      </div>
    ))}
    {showButton && (
      <LoadingSkeleton height="3rem" width="40%" className="mx-auto" />
    )}
  </div>
);

// Loading overlay component
export const LoadingOverlay: React.FC<{
  visible: boolean;
  message?: string;
  className?: string;
}> = ({ visible, message = 'Loading...', className }) => {
  if (!visible) return null;

  return (
    <div className={cn(
      'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50',
      'animate-fadeIn',
      className
    )}>
      <div className="bg-white rounded-2xl p-6 shadow-2xl animate-scaleIn">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-700 font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
};

// Pulse loading indicator
export const PulseLoading: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn(
      'flex space-x-1',
      className
    )}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn(
            sizeClasses[size],
            'bg-blue-500 rounded-full animate-pulse',
            'opacity-0'
          )}
          style={{
            animation: `pulse 1.4s ease-in-out infinite`,
            animationDelay: `${index * 0.16}s`
          }}
        />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
