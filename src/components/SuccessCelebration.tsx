import { useEffect, useState } from 'react';
import { CheckCircle, Sparkles, Trophy } from 'lucide-react';

interface SuccessCelebrationProps {
  trigger: boolean;
  message?: string;
  type?: 'success' | 'achievement' | 'milestone';
  onComplete?: () => void;
}

const SuccessCelebration = ({ trigger, message, type = 'success', onComplete }: SuccessCelebrationProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    if (trigger) {
      setIsVisible(true);
      
      // Generate random particles
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5
      }));
      setParticles(newParticles);

      // Auto hide after animation
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'achievement':
        return <Trophy className="h-16 w-16 text-yellow-400" />;
      case 'milestone':
        return <Sparkles className="h-16 w-16 text-purple-400" />;
      default:
        return <CheckCircle className="h-16 w-16 text-green-400" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'achievement':
        return ['from-yellow-400', 'to-amber-600'];
      case 'milestone':
        return ['from-purple-400', 'to-pink-600'];
      default:
        return ['from-green-400', 'to-emerald-600'];
    }
  };

  const [gradientFrom, gradientTo] = getColors();

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {/* Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full celebration"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: `linear-gradient(45deg, #0057d8, #0073e6)`,
            animationDelay: `${particle.delay}s`,
            animation: 'celebration-burst 2s ease-out forwards'
          }}
        />
      ))}

      {/* Main Celebration */}
      <div className="celebration glass-dark rounded-3xl p-8 text-center max-w-sm mx-4">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} mb-4 animate-bounce`}>
          {getIcon()}
        </div>
        
        {message && (
          <p className="text-white text-xl font-bold mb-2 animate-fadeInUp">
            {message}
          </p>
        )}
        
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* Confetti Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 celebration"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `hsl(${Math.random() * 360}, 70%, 60%)`,
              animationDelay: `${Math.random() * 1}s`,
              animation: 'celebration-burst 3s ease-out forwards'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SuccessCelebration;
