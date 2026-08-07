import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-[17px] font-semibold tracking-[-0.01em] ring-offset-background transition-[transform,background-color,opacity,box-shadow] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,122,255,0.25)] hover:bg-[#0066d6]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-[#e0342b]",
        outline:
          "border-0 bg-[#f2f2f7] text-[#007AFF] hover:bg-[#e5e5ea] dark:bg-white/10 dark:text-[#0A84FF] dark:hover:bg-white/15",
        secondary:
          "bg-[#f2f2f7] text-[#1d1d1f] hover:bg-[#e5e5ea] dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
        ghost:
          "bg-transparent text-[#007AFF] hover:bg-[#007AFF]/10 dark:text-[#0A84FF]",
        link: "text-[#007AFF] underline-offset-4 hover:underline dark:text-[#0A84FF]",
      },
      size: {
        default: "h-12 min-h-[48px] px-5 py-2",
        sm: "h-10 min-h-[40px] rounded-xl px-4 text-[15px]",
        lg: "h-14 min-h-[56px] rounded-[18px] px-8 text-[17px]",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
