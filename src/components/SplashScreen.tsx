import AuthMark from "@/components/AuthMark";

interface SplashScreenProps {
  message?: string;
}

const SplashScreen = ({ message }: SplashScreenProps) => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center">
        <AuthMark className="mx-auto mb-6 h-16 w-16" />
        <p className="text-2xl font-bold tracking-tight text-black">OpenPay</p>
        <p className="mt-1 text-sm text-gray-600">{message}</p>
        <p className="mt-1 text-xs font-medium tracking-normal text-gray-500">Powered by Pi Network</p>
        <div className="mx-auto mt-5 h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
      </div>
    </div>
  );
};

export default SplashScreen;
