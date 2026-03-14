import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showPasswordToggle?: boolean;
}

const PasswordInput = ({ 
  showPasswordToggle = true, 
  className, 
  ...props 
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  if (showPasswordToggle) {
    return (
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          className={`pr-12 ${className || ""}`}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-gray-500" />
          ) : (
            <Eye className="h-4 w-4 text-gray-500" />
          )}
        </Button>
      </div>
    );
  }

  return <Input type="password" className={className} {...props} />;
};

export { PasswordInput };
