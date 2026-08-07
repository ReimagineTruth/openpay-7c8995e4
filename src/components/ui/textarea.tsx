import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-[12px] border-0 bg-[#f2f2f7] px-3.5 py-3 text-[17px] tracking-[-0.01em] text-[#1d1d1f] shadow-none ring-offset-background placeholder:text-[#8e8e93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 md:text-[15px]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
