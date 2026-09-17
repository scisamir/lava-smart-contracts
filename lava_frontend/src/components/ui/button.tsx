import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* The landing page has exactly one button shape, a pill, in three fills:
   white (default), ember (the single primary action on a view), and a
   hairline ghost. Everything here is a variation on that. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tighter transition-[background,transform,opacity,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-white text-[#111318] shadow-[0_12px_40px_rgba(0,0,0,0.35)] hover:bg-[#f3f3f5]",
        ember:
          "bg-gradient-lava text-[#14090a] shadow-[0_12px_40px_rgba(223,71,61,0.3)] hover:brightness-110",
        outline:
          "bg-transparent text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] hover:bg-white/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]",
        secondary: "bg-white/[0.08] text-white hover:bg-white/[0.14]",
        ghost: "text-dim hover:bg-white/[0.06] hover:text-white",
        destructive:
          "bg-transparent text-[#df473d] shadow-[inset_0_0_0_1px_rgba(223,71,61,0.4)] hover:bg-[#df473d]/10",
        link: "text-[#ff9a4d] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-[22px] text-[15px]",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-14 px-8 text-[16px]",
        icon: "h-10 w-10 p-0",
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
