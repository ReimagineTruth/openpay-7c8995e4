import { cn } from "@/lib/utils";

interface AuthMarkProps {
  className?: string;
}

const AuthMark = ({ className }: AuthMarkProps) => (
  <div className={cn("h-16 w-16 flex items-center justify-center", className)}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="h-full w-full object-contain"
    >
      <circle cx="44" cy="50" r="21" fill="none" stroke="#ffffff" strokeWidth="13" opacity="0.8"/>
      <circle cx="56" cy="50" r="21" fill="none" stroke="#ffffff" strokeWidth="13"/>
    </svg>
  </div>
);

export default AuthMark;
