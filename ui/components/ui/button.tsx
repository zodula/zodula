import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "zd:inline-flex zd:items-center zd:justify-center zd:rounded zd:transition-colors zd:disabled:pointer-events-none zd:disabled:opacity-50 zd:cursor-pointer zd:h-8 zd:px-3 zd:w-fit zd:gap-2",
  {
    variants: {
      variant: {
        destructive:
          "zd:bg-destructive zd:text-primary-foreground zd:hover:bg-destructive/90 zd:active:bg-destructive/95 zd:active:shadow-sm",
        solid:
          "zd:bg-primary zd:text-primary-foreground zd:hover:bg-primary/90 zd:active:bg-primary/95 zd:active:shadow-sm",
        subtle:
          "zd:bg-secondary zd:text-secondary-foreground zd:hover:bg-secondary/80 zd:active:bg-secondary/90",
        outline:
          "zd:border zd:border-input zd:bg-background zd:hover:bg-accent zd:hover:text-accent-foreground zd:hover:border-accent zd:active:bg-accent/80",
        ghost:
          "zd:hover:bg-accent zd:hover:text-accent-foreground zd:active:bg-accent/80",
        success:
          "zd:bg-success zd:text-success-foreground zd:hover:bg-success/90 zd:active:bg-success/95 zd:active:shadow-sm",
      },
      size: {
        default: "zd:h-8 zd:text-base",
        sm: "zd:h-7 zd:text-sm",
        lg: "zd:h-10 zd:text-lg",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "default",
    },
  }
);

interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => any | Promise<any>;
  hideLoading?: boolean;
}

function Button({
  className,
  variant,
  asChild = false,
  loading = false,
  size = "default",
  children,
  onClick,
  disabled,
  hideLoading = false,
  ...props
}: ButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const Comp = asChild ? Slot : "button";

  const handleClick = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || isLoading || disabled) return;

      if (onClick) {
        try {
          setIsLoading(true);
          const result = onClick(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
        } finally {
          setIsLoading(false);
        }
      }
    },
    [onClick, loading, isLoading, disabled]
  );

  const isButtonLoading = loading || isLoading;
  const isDisabled = disabled || isButtonLoading;

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      onClick={handleClick}
      {...props}
    >
      {isButtonLoading && !hideLoading && (
        <Loader2 className="zd:mr-2 zd:h-4 zd:w-4 zd:animate-spin" />
      )}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
