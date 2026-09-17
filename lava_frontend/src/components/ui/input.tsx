import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-full bg-white/[0.04] px-4 text-[14px] tracking-tighter shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow",
          "placeholder:text-dim file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(255,154,77,0.55)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
