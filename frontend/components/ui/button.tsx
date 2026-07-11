"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white font-semibold shadow-[var(--shadow-pop)] hover:bg-accent-hover after:ml-1.5 after:content-['→']",
        accent: "bg-accent text-white font-semibold hover:bg-accent-hover",
        outline:
          "border border-border bg-surface text-fg hover:border-ink hover:text-ink",
        ghost: "text-fg hover:bg-st-gray-bg",
        danger: "bg-st-red text-white hover:brightness-95",
        link: "text-fg underline-offset-4 hover:text-ink hover:underline p-0 h-auto",
        /* Graphite CTA: kept for call sites on dark/photo surfaces that need
           a solid graphite action instead of the green primary. */
        cta: "bg-ink text-white font-semibold hover:bg-ink-hover after:ml-1.5 after:content-['→']",
      },
      size: {
        sm: "h-10 px-4 text-[13px]",
        md: "h-12 px-5 text-[14px]",
        lg: "h-14 px-7 text-[15px]",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
