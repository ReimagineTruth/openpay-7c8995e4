import AuthMark from "@/components/AuthMark";

interface SplashScreenProps {
  message?: string;
}

const SplashScreen = ({ message }: SplashScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-paypal-blue via-blue-600 to-[#072a7a] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 10}s`
            }}
          >
            <div className={`h-2 w-2 rounded-full bg-white/20 blur-sm ${i % 3 === 0 ? 'animate-pulse' : ''}`} />
          </div>
        ))}
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-400/20 blur-3xl animate-pulse animation-delay-1000" />
      </div>

      {/* Glass morphism container */}
      <div className="relative glass rounded-[3rem] p-12 shadow-2xl shadow-black/20 backdrop-blur-xl border border-white/10 max-w-sm w-full animate-scaleIn">
        <div className="text-center space-y-8">
          {/* First Row: Logo and App Name */}
          <div className="space-y-4">
            {/* Logo with enhanced animation */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-paypal-blue/20 blur-xl animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-white/10 blur-lg animate-float" />
              <AuthMark className="relative mx-auto h-20 w-20 animate-float drop-shadow-2xl" />
            </div>

            {/* App name with enhanced styling */}
            <h1 className="text-5xl font-black tracking-tight text-white animate-fadeInUp bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              OpenPay
            </h1>
          </div>

          {/* Second Row: Status and Loading */}
          <div className="space-y-6">
            {/* Status message with enhanced typography */}
            <p className="text-lg text-white/90 animate-fadeInUp font-medium" style={{ animationDelay: '0.2s' }}>
              {message || 'Loading your financial hub...'}
            </p>

            {/* Powered by with enhanced styling */}
            <p className="text-sm font-medium text-white/70 animate-fadeInUp tracking-wide" style={{ animationDelay: '0.4s' }}>
              Powered by Pi Network
            </p>

            {/* Enhanced loading spinner */}
            <div className="flex justify-center animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-3 border-white/20 border-t-white animate-spin" />
                <div className="absolute inset-0 h-12 w-12 rounded-full border-3 border-transparent border-b-paypal-blue/50 animate-spin animation-delay-150" />
                <div className="absolute inset-0 h-12 w-12 rounded-full border-3 border-transparent border-r-white/30 animate-spin animation-delay-300" />
              </div>
            </div>

            {/* Enhanced loading dots */}
            <div className="flex justify-center gap-2 animate-fadeInUp" style={{ animationDelay: '0.8s' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3 w-3 rounded-full bg-gradient-to-r from-white/60 to-blue-200/60 animate-bounce shadow-lg shadow-white/20"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>

            {/* Progress indicator */}
            <div className="animate-fadeInUp" style={{ animationDelay: '1s' }}>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-white/40 to-white/60 rounded-full animate-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/20 to-transparent" />
      
      {/* Top gradient overlay */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/10 to-transparent" />
    </div>
  );
};

export default SplashScreen;
