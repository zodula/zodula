import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "zd:inline-flex zd:items-center zd:justify-center zd:rounded-lg zd:transition-all zd:duration-150 zd:disabled:pointer-events-none zd:disabled:opacity-50 zd:cursor-pointer zd:h-9 zd:px-3.5 zd:w-fit zd:gap-1.5 zd:text-sm zd:font-medium zd:select-none zd:focus-visible:outline-none zd:focus-visible:ring-2 zd:focus-visible:ring-ring zd:focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        destructive:
          "zd:bg-destructive zd:text-white zd:hover:bg-destructive/90 zd:active:scale-[0.98] zd:shadow-sm",
        solid:
          "zd:bg-primary zd:text-primary-foreground zd:hover:bg-primary/90 zd:active:scale-[0.98] zd:shadow-sm",
        subtle:
          "zd:bg-secondary zd:text-secondary-foreground zd:hover:bg-secondary/70 zd:active:scale-[0.98]",
        outline:
          "zd:border zd:border-border zd:bg-background zd:text-foreground zd:hover:bg-accent zd:hover:text-accent-foreground zd:active:scale-[0.98]",
        ghost:
          "zd:text-foreground zd:hover:bg-accent zd:hover:text-accent-foreground zd:active:scale-[0.98]",
        success:
          "zd:bg-success zd:text-success-foreground zd:hover:bg-success/90 zd:active:scale-[0.98] zd:shadow-sm",
      },
      size: {
        default: "zd:h-9 zd:text-sm",
        sm: "zd:h-7 zd:text-xs zd:px-2.5",
        lg: "zd:h-10 zd:text-base zd:px-5",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "default",
    },
  }
);

type ButtonBaseProps = {
  asChild?: boolean;
  loading?: boolean;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => any | Promise<any>;
  hideLoading?: boolean;
  href?: string;
  target?: string;
  rel?: string;
};

type ButtonProps = ButtonBaseProps &
  Omit<React.ComponentProps<"button">, "onClick" | "children"> &
  Omit<React.ComponentProps<"a">, "onClick" | "children"> &
  VariantProps<typeof buttonVariants>;

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
  href,
  target,
  rel,
  ...props
}: ButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const Comp = asChild ? Slot : href ? "a" : "button";

  const handleClick = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      if (loading || isLoading || disabled) {
        event.preventDefault();
        return;
      }

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
      disabled={!href ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      onClick={handleClick}
      href={href}
      target={href ? target : undefined}
      rel={href ? rel : undefined}
      role={!asChild && href ? "button" : undefined}
      {...props}
    >
      {!asChild && isButtonLoading && !hideLoading && (
        <Loader2 className="zd:mr-2 zd:h-4 zd:w-4 zd:animate-spin" />
      )}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
