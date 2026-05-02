import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animated?: boolean;
}

const LoadingSkeleton = ({ 
  className, 
  variant = 'rectangular', 
  width, 
  height, 
  lines = 1,
  animated = true 
}: LoadingSkeletonProps) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circular':
        return 'rounded-full';
      case 'rounded':
        return 'rounded-lg';
      default:
        return 'rounded';
    }
  };

  const getSkeletonClasses = () => {
    return cn(
      'skeleton-enhanced',
      animated && 'animate-shimmer',
      getVariantClasses(),
      className
    );
  };

  const style = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : undefined),
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={getSkeletonClasses()}
            style={{
              ...style,
              width: i === lines - 1 ? '70%' : '100%', // Last line shorter
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div 
      className={getSkeletonClasses()} 
      style={style}
    />
  );
};

// Card Skeleton Component
export const CardSkeleton = () => (
  <div className="paypal-surface rounded-3xl p-6 space-y-4">
    <div className="flex items-center space-x-4">
      <LoadingSkeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <LoadingSkeleton variant="text" height={20} />
        <LoadingSkeleton variant="text" width="60%" height={16} />
      </div>
    </div>
    <div className="space-y-2">
      <LoadingSkeleton variant="text" height={16} />
      <LoadingSkeleton variant="text" width="80%" height={16} />
    </div>
  </div>
);

// Transaction List Skeleton
export const TransactionSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="paypal-surface rounded-2xl p-4 flex items-center space-x-4">
        <LoadingSkeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton variant="text" height={16} />
          <LoadingSkeleton variant="text" width="40%" height={14} />
        </div>
        <LoadingSkeleton variant="text" width={80} height={16} />
      </div>
    ))}
  </div>
);

// Dashboard Skeleton
export const DashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Balance Card */}
    <div className="paypal-surface rounded-3xl p-6">
      <LoadingSkeleton variant="text" width="40%" height={20} className="mb-4" />
      <LoadingSkeleton variant="text" height={32} className="mb-2" />
      <LoadingSkeleton variant="text" width="60%" height={16} />
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="text-center space-y-2">
          <LoadingSkeleton variant="circular" width={48} height={48} className="mx-auto" />
          <LoadingSkeleton variant="text" height={14} />
        </div>
      ))}
    </div>

    {/* Recent Transactions */}
    <div>
      <LoadingSkeleton variant="text" width="30%" height={20} className="mb-4" />
      <TransactionSkeleton />
    </div>
  </div>
);

export default LoadingSkeleton;
