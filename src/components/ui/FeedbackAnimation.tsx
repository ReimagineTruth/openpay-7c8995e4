import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, AlertCircle, Info } from 'lucide-react';

interface FeedbackAnimationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  visible: boolean;
  onComplete?: () => void;
  className?: string;
  duration?: number;
}

export const FeedbackAnimation: React.FC<FeedbackAnimationProps> = ({
  type,
  message,
  visible,
  onComplete,
  className,
  duration = 3000
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onComplete]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check className="h-5 w-5" />;
      case 'error':
        return <X className="h-5 w-5" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white border-green-600';
      case 'error':
        return 'bg-red-500 text-white border-red-600';
      case 'warning':
        return 'bg-yellow-500 text-white border-yellow-600';
      case 'info':
        return 'bg-blue-500 text-white border-blue-600';
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const getAnimationClass = () => {
    switch (type) {
      case 'success':
        return 'success-animation';
      case 'error':
        return 'error-shake';
      case 'warning':
        return 'animate-bounce';
      case 'info':
        return 'animate-fadeIn';
      default:
        return 'animate-fadeIn';
    }
  };

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg',
        getColors(),
        getAnimationClass(),
        'animate-slideInRight',
        className
      )}
    >
      <div className="flex-shrink-0">
        {getIcon()}
      </div>
      <p className="font-medium">{message}</p>
    </div>
  );
};

// Floating action button with animation
interface AnimatedFabProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const AnimatedFab: React.FC<AnimatedFabProps> = ({
  onClick,
  icon,
  label,
  className,
  position = 'bottom-right'
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'fab',
        positionClasses[position],
        'animate-fadeIn',
        className
      )}
      title={label}
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
};

// Progress ring with animation
interface AnimatedProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  color?: string;
}

export const AnimatedProgressRing: React.FC<AnimatedProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  className,
  showPercentage = true,
  color = '#0057d8'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="progress-ring transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring-circle transition-all duration-500 ease-out"
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold count-animation">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
};

// Status badge with animation
interface AnimatedStatusBadgeProps {
  status: 'success' | 'pending' | 'error' | 'info';
  label: string;
  className?: string;
  animated?: boolean;
}

export const AnimatedStatusBadge: React.FC<AnimatedStatusBadgeProps> = ({
  status,
  label,
  className,
  animated = true
}) => {
  const getStatusClasses = () => {
    switch (status) {
      case 'success':
        return 'status-badge-success';
      case 'pending':
        return 'status-badge-pending';
      case 'error':
        return 'status-badge-error';
      case 'info':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  return (
    <span
      className={cn(
        'status-badge',
        getStatusClasses(),
        animated && 'animate-scaleIn',
        className
      )}
    >
      {label}
    </span>
  );
};

// Confetti celebration component
export const ConfettiCelebration: React.FC<{
  trigger: boolean;
  onComplete?: () => void;
}> = ({ trigger, onComplete }) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);

  useEffect(() => {
    if (trigger) {
      const colors = ['#0057d8', '#0073e6', '#16a34a', '#f59e0b', '#ef4444'];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      
      setParticles(newParticles);
      
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full celebration"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            backgroundColor: particle.color,
            animation: 'celebration-burst 3s ease-out forwards'
          }}
        />
      ))}
    </div>
  );
};

// Ripple effect component
export const RippleEffect: React.FC<{
  trigger: boolean;
  x: number;
  y: number;
  color?: string;
  onComplete?: () => void;
}> = ({ trigger, x, y, color = 'rgba(255, 255, 255, 0.6)', onComplete }) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    if (trigger) {
      const newRipple = {
        id: Date.now(),
        x,
        y
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      const timer = setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        onComplete?.();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [trigger, x, y, onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '0',
            height: '0',
            backgroundColor: color,
            transform: 'translate(-50%, -50%)',
            animation: 'ripple 0.6s ease-out forwards'
          }}
        />
      ))}
    </div>
  );
};

// Magnetic button effect
export const MagneticButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <button
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative transition-transform duration-200 ease-out hover-lift',
        className
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
    >
      {children}
    </button>
  );
};

export default FeedbackAnimation;
