import { cn } from "@/lib/utils";

interface AuthMarkProps {
  className?: string;
}

const AuthMark = ({ className }: AuthMarkProps) => (
  <img
    src="/openpay-auth-logo.png"
    alt="OpenPay"
    className={cn("h-24 w-24 object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]", className)}
  />
);

export default AuthMark;
