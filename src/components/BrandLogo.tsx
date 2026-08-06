import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  animate?: boolean;
  /** `white` for dark/black Apple Pay-style buttons */
  variant?: "color" | "white";
}

const BrandLogo = ({ className, animate = true, variant = "color" }: BrandLogoProps) => {
  return (
    <img
      src={variant === "white" ? "/openpay-o-white.svg" : "/openpay-o.svg"}
      alt="OpenPay"
      className={cn(
        "h-12 w-12 transition-all duration-300",
        animate && "hover:scale-110 hover:rotate-3 hover:shadow-lg hover:shadow-blue-500/25",
        animate && "animate-pulse-slow",
        className
      )}
    />
  );
};

export default BrandLogo;
