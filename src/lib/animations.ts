// OpenPay Animation Utilities
// Comprehensive animation system for enhanced user experience
import { useCallback } from 'react';

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: string;
  fill?: 'forwards' | 'backwards' | 'both' | 'none';
}

export interface StaggerConfig {
  staggerDelay?: number;
  from?: 'first' | 'last' | 'center';
}

// Animation presets
export const ANIMATION_PRESETS = {
  // Entrance animations
  fadeIn: {
    keyframes: [
      { opacity: 0 },
      { opacity: 1 }
    ] as Keyframe[],
    options: { duration: 400, easing: 'ease-out' }
  },
  
  fadeInUp: {
    keyframes: [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ] as Keyframe[],
    options: { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  },
  
  fadeInDown: {
    keyframes: [
      { opacity: 0, transform: 'translateY(-20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ] as Keyframe[],
    options: { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  },
  
  slideInLeft: {
    keyframes: [
      { opacity: 0, transform: 'translateX(-30px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ] as Keyframe[],
    options: { duration: 500, easing: 'ease-out' }
  },
  
  slideInRight: {
    keyframes: [
      { opacity: 0, transform: 'translateX(30px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ] as Keyframe[],
    options: { duration: 500, easing: 'ease-out' }
  },
  
  scaleIn: {
    keyframes: [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' }
    ] as Keyframe[],
    options: { duration: 400, easing: 'ease-out' }
  },
  
  // Exit animations
  fadeOut: {
    keyframes: [
      { opacity: 1 },
      { opacity: 0 }
    ] as Keyframe[],
    options: { duration: 300, easing: 'ease-in' }
  },
  
  fadeOutUp: {
    keyframes: [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-20px)' }
    ] as Keyframe[],
    options: { duration: 400, easing: 'ease-in' }
  },
  
  // Emphasis animations
  pulse: {
    keyframes: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.05)' },
      { transform: 'scale(1)' }
    ] as Keyframe[],
    options: { duration: 600, easing: 'ease-in-out' }
  },
  
  bounce: {
    keyframes: [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-10px)' },
      { transform: 'translateY(0)' }
    ] as Keyframe[],
    options: { duration: 800, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
  },
  
  shake: {
    keyframes: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(5px)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(0)' }
    ] as Keyframe[],
    options: { duration: 500, easing: 'ease-in-out' }
  },
  
  // Loading animations
  spin: {
    keyframes: [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' }
    ] as Keyframe[],
    options: { duration: 1000, easing: 'linear' }
  },
  
  shimmer: {
    keyframes: [
      { backgroundPosition: '-200% 0' },
      { backgroundPosition: '200% 0' }
    ] as Keyframe[],
    options: { duration: 2000, easing: 'ease-in-out' }
  }
} as const;

// Animation utility functions
export const animateElement = (
  element: HTMLElement,
  preset: keyof typeof ANIMATION_PRESETS,
  config: Partial<AnimationConfig> = {}
): Animation => {
  const animationPreset = ANIMATION_PRESETS[preset];
  const animationConfig = { ...animationPreset.options, ...config };
  
  return element.animate(animationPreset.keyframes, animationConfig);
};

export const staggeredAnimation = (
  elements: HTMLElement[],
  preset: keyof typeof ANIMATION_PRESETS,
  config: StaggerConfig & Partial<AnimationConfig> = {}
): Animation[] => {
  const { staggerDelay = 100, from = 'first', ...animationConfig } = config;
  const animations: Animation[] = [];
  
  elements.forEach((element, index) => {
    let delay = animationConfig.delay || 0;
    
    if (from === 'first') {
      delay += index * staggerDelay;
    } else if (from === 'last') {
      delay += (elements.length - 1 - index) * staggerDelay;
    } else if (from === 'center') {
      const centerIndex = Math.floor(elements.length / 2);
      delay += Math.abs(index - centerIndex) * staggerDelay;
    }
    
    animations.push(animateElement(element, preset, { ...animationConfig, delay }));
  });
  
  return animations;
};

// Skeleton loading component generator
export const createSkeleton = (
  width: string,
  height: string,
  borderRadius: string = '0.5rem'
): string => {
  return `
    <div class="skeleton-enhanced" style="
      width: ${width};
      height: ${height};
      border-radius: ${borderRadius};
    "></div>
  `;
};

// Success/error feedback animations
export const showSuccess = (element: HTMLElement): void => {
  element.classList.add('success-animation');
  setTimeout(() => {
    element.classList.remove('success-animation');
  }, 600);
};

export const showError = (element: HTMLElement): void => {
  element.classList.add('error-shake');
  setTimeout(() => {
    element.classList.remove('error-shake');
  }, 500);
};

// Number counting animation
export const animateNumber = (
  element: HTMLElement,
  start: number,
  end: number,
  duration: number = 1000
): void => {
  const startTime = performance.now();
  const difference = end - start;
  
  const updateNumber = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const current = start + (difference * progress);
    element.textContent = current.toFixed(2);
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  };
  
  requestAnimationFrame(updateNumber);
};

// Page transition utilities
export const pageTransition = {
  enter: (element: HTMLElement): Promise<void> => {
    return new Promise((resolve) => {
      const animation = animateElement(element, 'fadeInUp', { duration: 600 });
      animation.onfinish = () => resolve();
    });
  },
  
  exit: (element: HTMLElement): Promise<void> => {
    return new Promise((resolve) => {
      const animation = animateElement(element, 'fadeOutUp', { duration: 400 });
      animation.onfinish = () => resolve();
    });
  }
};

// Intersection Observer for scroll animations
export const createScrollAnimator = (
  elements: HTMLElement[],
  preset: keyof typeof ANIMATION_PRESETS,
  options: IntersectionObserverInit = {}
): IntersectionObserver => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateElement(entry.target as HTMLElement, preset);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '50px',
    ...options
  });
  
  elements.forEach((element) => observer.observe(element));
  return observer;
};

// CSS animation class utilities
export const ANIMATION_CLASSES = {
  // Base animations
  animate: 'animate',
  animateFadeIn: 'animate-fadeIn',
  animateFadeInUp: 'animate-fadeInUp',
  animateFadeInDown: 'animate-fadeInDown',
  animateSlideInLeft: 'animate-slideInLeft',
  animateSlideInRight: 'animate-slideInRight',
  animateScaleIn: 'animate-scaleIn',
  
  // Interactive animations
  hoverLift: 'hover-lift',
  hoverLiftEnhanced: 'hover-lift-enhanced',
  hoverGlow: 'hover-glow',
  btnPress: 'btn-press',
  
  // Loading animations
  skeleton: 'skeleton',
  skeletonEnhanced: 'skeleton-enhanced',
  shimmer: 'animate-shimmer',
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  
  // Status animations
  success: 'success-animation',
  error: 'error-shake',
  celebration: 'celebration',
  
  // Staggered animations
  staggerItem: 'stagger-item',
  
  // Special effects
  pulseGlow: 'pulse-glow',
  float: 'animate-float',
  bounce: 'animate-bounce'
} as const;

// Animation hook for React components
export const useAnimation = () => {
  const animateElements = useCallback((
    selector: string,
    preset: keyof typeof ANIMATION_PRESETS,
    config?: Partial<AnimationConfig>
  ) => {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).map((element) => 
      animateElement(element as HTMLElement, preset, config)
    );
  }, []);
  
  const animateWithStagger = useCallback((
    selector: string,
    preset: keyof typeof ANIMATION_PRESETS,
    config?: StaggerConfig & Partial<AnimationConfig>
  ) => {
    const elements = document.querySelectorAll(selector);
    return staggeredAnimation(Array.from(elements) as HTMLElement[], preset, config);
  }, []);
  
  return {
    animateElements,
    animateWithStagger,
    animateElement,
    staggeredAnimation,
    showSuccess,
    showError,
    animateNumber,
    pageTransition,
    createScrollAnimator
  };
};

// Performance optimized animation utilities
export const optimizedAnimation = {
  // Use CSS transforms instead of changing layout properties
  transform: (element: HTMLElement, transform: string): void => {
    element.style.transform = transform;
  },
  
  // Use opacity for fade effects
  fade: (element: HTMLElement, opacity: number): void => {
    element.style.opacity = opacity.toString();
  },
  
  // Batch DOM updates for better performance
  batchUpdate: (updates: (() => void)[]): void => {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }
};

// Accessibility utilities
export const accessibilityAnimation = {
  // Respect user's motion preferences
  shouldReduceMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  
  // Get animation duration based on preferences
  getDuration: (baseDuration: number): number => {
    return accessibilityAnimation.shouldReduceMotion() ? 0 : baseDuration;
  },
  
  // Safe animation that respects preferences
  safeAnimate: (
    element: HTMLElement,
    preset: keyof typeof ANIMATION_PRESETS,
    config: Partial<AnimationConfig> = {}
  ): Animation | null => {
    if (accessibilityAnimation.shouldReduceMotion()) {
      return null;
    }
    
    const adjustedConfig = {
      ...config,
      duration: accessibilityAnimation.getDuration(config.duration || ANIMATION_PRESETS[preset].options.duration)
    };
    
    return animateElement(element, preset, adjustedConfig);
  }
};
