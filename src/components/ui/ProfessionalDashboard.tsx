import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
}

interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  subtitle,
  children,
  className,
  size = 'medium'
}) => {
  const sizeClasses = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2',
    large: 'col-span-1 md:col-span-2 lg:col-span-3',
    full: 'col-span-1 md:col-span-2 lg:col-span-4'
  };

  return (
    <div className={cn('premium-card p-6', sizeClasses[size], className)}>
      {(title || subtitle) && (
        <div className="mb-6 pb-4 border-b border-border">
          {title && (
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              {title}
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  className,
  columns = 3
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={cn(
      'grid gap-6 auto-rows-auto',
      gridClasses[columns],
      className
    )}>
      {children}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
  trend?: 'up' | 'down' | 'stable';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  className,
  trend = 'stable'
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getChangeColor = () => {
    if (!change) return 'text-muted-foreground';
    switch (change.type) {
      case 'increase':
        return 'text-green-600 dark:text-green-400';
      case 'decrease':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn('premium-card p-6 hover:scale-105 transition-transform duration-300', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {value}
          </p>
        </div>
        {icon && (
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
        )}
      </div>
      
      {(change || trend !== 'stable') && (
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', getChangeColor())}>
            {change && (
              <>
                {change.type === 'increase' ? '+' : ''}
                {change.value}%
              </>
            )}
          </span>
          <span className={cn('text-xs', getTrendColor())}>
            {getTrendIcon()}
          </span>
        </div>
      )}
    </div>
  );
};

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

export const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon,
  onClick,
  className,
  color = 'primary'
}) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary hover:bg-primary/20',
    secondary: 'bg-secondary/10 text-secondary-foreground hover:bg-secondary/20',
    success: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30',
    warning: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30',
    error: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'premium-card p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-lg group',
        colorClasses[color],
        className
      )}
    >
      <div className="flex items-center gap-4 mb-3">
        <div className="p-2 rounded-lg bg-current/10">
          {icon}
        </div>
      </div>
      <h4 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
        {title}
      </h4>
      <p className="text-sm text-muted-foreground">
        {description}
      </p>
    </button>
  );
};

interface ActivityFeedProps {
  title: string;
  activities: Array<{
    id: string;
    title: string;
    description: string;
    time: string;
    type: 'transaction' | 'notification' | 'system' | 'success';
  }>;
  className?: string;
  maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  title,
  activities,
  className,
  maxItems = 5
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transaction':
        return '💳';
      case 'notification':
        return '🔔';
      case 'system':
        return '⚙️';
      case 'success':
        return '✅';
      default:
        return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transaction':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
      case 'notification':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'system':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400';
      case 'success':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className={cn('premium-card p-6', className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        {title}
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
      </h3>
      
      <div className="space-y-4">
        {displayActivities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className={cn('p-2 rounded-full text-sm', getTypeColor(activity.type))}>
              {getTypeIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground text-sm mb-1">
                {activity.title}
              </h4>
              <p className="text-xs text-muted-foreground mb-1">
                {activity.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {activities.length > maxItems && (
        <button className="w-full mt-4 text-center text-sm text-primary hover:text-primary/80 transition-colors">
          View all activities ({activities.length - maxItems} more)
        </button>
      )}
    </div>
  );
};

