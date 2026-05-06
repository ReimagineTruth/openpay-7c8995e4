import { cn } from "@/lib/utils";

interface AuthMarkProps {
  className?: string;
}

const AuthMark = ({ className }: AuthMarkProps) => (
  <div className={cn("h-12 w-12 flex items-center justify-center", className)}>
    <img
      src="/openpay-o-white.svg"
      alt="OpenPay logo"
      className="h-full w-full object-contain"
    />
  </div>
);

export default AuthMark;
