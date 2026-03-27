import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  animate?: boolean;
}

const BrandLogo = ({ className, animate = true }: BrandLogoProps) => {
  return (
    <img 
      src="/openpay-logo.jpg"
      alt="OpenPay logo" 
      className={cn(
        "h-20 w-20 rounded-full transition-all duration-300",
        animate && "hover:scale-110 hover:rotate-3 hover:shadow-lg hover:shadow-blue-500/25",
        animate && "animate-pulse-slow",
        className
      )}
    />
  );
};

export default BrandLogo;
