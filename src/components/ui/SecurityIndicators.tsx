import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, Lock, CheckCircle, AlertCircle, Eye, Fingerprint, Smartphone } from 'lucide-react';

interface SecurityBadgeProps {
  status: 'verified' | 'secured' | 'warning' | 'error';
  label: string;
  description?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({
  status,
  label,
  description,
  className,
  size = 'md'
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4" />;
      case 'secured':
        return <Lock className="w-4 h-4" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getStatusColors = () => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
      case 'secured':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border font-medium transition-all duration-300',
      getStatusColors(),
      sizeClasses[size],
      className
    )}>
      {getStatusIcon()}
      <span>{label}</span>
      {description && (
        <span className="hidden sm:inline text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  );
};

interface TrustIndicatorProps {
  type: 'encryption' | 'biometric' | 'two-factor' | 'ssl' | 'compliance';
  verified?: boolean;
  className?: string;
}

export const TrustIndicator: React.FC<TrustIndicatorProps> = ({
  type,
  verified = true,
  className
}) => {
  const getIndicatorInfo = () => {
    switch (type) {
      case 'encryption':
        return {
          icon: <Lock className="w-5 h-5" />,
          label: 'End-to-End Encryption',
          description: 'Your data is encrypted with military-grade security'
        };
      case 'biometric':
        return {
          icon: <Fingerprint className="w-5 h-5" />,
          label: 'Biometric Authentication',
          description: 'Secure login with fingerprint or face recognition'
        };
      case 'two-factor':
        return {
          icon: <Smartphone className="w-5 h-5" />,
          label: 'Two-Factor Authentication',
          description: 'Extra security layer for your account'
        };
      case 'ssl':
        return {
          icon: <Shield className="w-5 h-5" />,
          label: 'SSL Secured',
          description: '256-bit SSL encryption for all transactions'
        };
      case 'compliance':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          label: 'PCI DSS Compliant',
          description: 'Meets industry security standards'
        };
      default:
        return {
          icon: <Shield className="w-5 h-5" />,
          label: 'Secure',
          description: 'Protected by advanced security measures'
        };
    }
  };

  const info = getIndicatorInfo();

  return (
    <div className={cn(
      'premium-card p-4 flex items-center gap-4 hover:scale-105 transition-transform duration-300',
      !verified && 'opacity-60',
      className
    )}>
      <div className={cn(
        'p-2 rounded-lg',
        verified ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400'
      )}>
        {info.icon}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-foreground text-sm">
            {info.label}
          </h4>
          {verified && (
            <CheckCircle className="w-3 h-3 text-green-500" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {info.description}
        </p>
      </div>
    </div>
  );
};

interface SecurityStatusProps {
  overallStatus: 'excellent' | 'good' | 'fair' | 'poor';
  score?: number;
  lastChecked?: string;
  className?: string;
}

export const SecurityStatus: React.FC<SecurityStatusProps> = ({
  overallStatus,
  score,
  lastChecked,
  className
}) => {
  const getStatusInfo = () => {
    switch (overallStatus) {
      case 'excellent':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          label: 'Excellent Security',
          description: 'All security measures are active and up to date'
        };
      case 'good':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          label: 'Good Security',
          description: 'Most security measures are active'
        };
      case 'fair':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          label: 'Fair Security',
          description: 'Some security measures need attention'
        };
      case 'poor':
        return {
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          label: 'Poor Security',
          description: 'Security measures need immediate attention'
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          label: 'Unknown Status',
          description: 'Security status could not be determined'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={cn('premium-card p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Security Status
        </h3>
        <SecurityBadge 
          status={overallStatus === 'excellent' ? 'verified' : overallStatus === 'good' ? 'secured' : 'warning'}
          label={statusInfo.label}
          size="sm"
        />
      </div>

      <div className="space-y-4">
        {score !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Security Score</span>
            <span className={cn('text-lg font-bold', statusInfo.color)}>
              {score}/100
            </span>
          </div>
        )}

        <div className={cn(
          'w-full h-2 rounded-full overflow-hidden',
          statusInfo.bgColor
        )}>
          <div 
            className={cn(
              'h-full transition-all duration-500',
              statusInfo.color === 'text-green-600' || statusInfo.color === 'text-green-400' ? 'bg-green-500' :
              statusInfo.color === 'text-blue-600' || statusInfo.color === 'text-blue-400' ? 'bg-blue-500' :
              statusInfo.color === 'text-yellow-600' || statusInfo.color === 'text-yellow-400' ? 'bg-yellow-500' :
              'bg-red-500'
            )}
            style={{ width: `${score || 0}%` }}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {statusInfo.description}
        </p>

        {lastChecked && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-3 h-3" />
            <span>Last checked: {lastChecked}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface SecurityFeaturesProps {
  features: Array<{
    name: string;
    enabled: boolean;
    description: string;
    icon?: React.ReactNode;
  }>;
  className?: string;
}

export const SecurityFeatures: React.FC<SecurityFeaturesProps> = ({
  features,
  className
}) => {
  return (
    <div className={cn('premium-card p-6', className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Security Features
      </h3>
      
      <div className="space-y-3">
        {features.map((feature, index) => (
          <div 
            key={index}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all duration-300',
              feature.enabled 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' 
                : 'bg-gray-50 border-gray-200 dark:bg-gray-900/10 dark:border-gray-800'
            )}
          >
            <div className="flex-shrink-0">
              {feature.icon || (
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center',
                  feature.enabled 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-400 text-white'
                )}>
                  {feature.enabled ? '✓' : '✗'}
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                'font-medium text-sm mb-1',
                feature.enabled ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {feature.name}
              </h4>
              <p className="text-xs text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

