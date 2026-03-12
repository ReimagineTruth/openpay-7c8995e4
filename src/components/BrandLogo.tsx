import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
}

const BrandLogo = ({ className }: BrandLogoProps) => {
  return (
    <img 
      src="/openpay-logo.jpg"
      alt="OpenPay logo" 
      className={cn("h-12 w-12 rounded-full", className)}
    />
  );
};

export default BrandLogo;
