import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/zodula/ui/lib/utils"

const badgeVariants = cva(
  "zd:inline-flex zd:items-center zd:justify-center zd:rounded-md zd:px-2 zd:py-1 zd:w-fit zd:whitespace-nowrap zd:shrink-0 [&>svg]:size-3 zd:gap-1 [&>svg]:pointer-events-none focus-visible:ring-ring/50 focus-visible:ring-[3px] zd:aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 zd:transition-[color,box-shadow] zd:overflow-hidden zd:h-fit",
  {
    variants: {
      variant: {
        default:
          "zd:border-transparent zd:bg-primary zd:text-primary-foreground zd:[a&]:hover:bg-primary/90",
        secondary:
          "zd:border-transparent zd:bg-secondary zd:text-secondary-foreground zd:[a&]:hover:bg-secondary/90",
        destructive:
          "zd:border-transparent zd:bg-destructive zd:text-primary-foreground zd:[a&]:hover:bg-destructive/90 zd:focus-visible:ring-destructive/20 dark:zd:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        warning:
          "zd:border-transparent zd:bg-warning zd:text-warning-foreground zd:[a&]:hover:bg-warning/90 zd:focus-visible:ring-warning/20 dark:zd:focus-visible:ring-warning/40",
        success:
          "zd:border-transparent zd:bg-success zd:text-success-foreground zd:[a&]:hover:bg-success/90 zd:focus-visible:ring-success/20 dark:zd:focus-visible:ring-success/40",
        outline:
          "zd:border zd:border-border zd:text-foreground zd:[a&]:hover:bg-accent zd:[a&]:hover:text-accent-foreground",
        // Status-specific variants for beautiful color-coded badges
        draft:
          "zd:border-transparent zd:bg-yellow-100 zd:text-yellow-800 zd:dark:bg-yellow-900/20 zd:dark:text-yellow-400",
        submitted:
          "zd:border-transparent zd:bg-green-100 zd:text-green-800 zd:dark:bg-green-900/20 zd:dark:text-green-400",
        cancelled:
          "zd:border-transparent zd:bg-red-100 zd:text-red-800 zd:dark:bg-red-900/20 zd:dark:text-red-400",
        pending:
          "zd:border-transparent zd:bg-blue-100 zd:text-blue-800 zd:dark:bg-blue-900/20 zd:dark:text-blue-400",
        approved:
          "zd:border-transparent zd:bg-emerald-100 zd:text-emerald-800 zd:dark:bg-emerald-900/20 zd:dark:text-emerald-400",
        rejected:
          "zd:border-transparent zd:bg-rose-100 zd:text-rose-800 zd:dark:bg-rose-900/20 zd:dark:text-rose-400",
        // Muted variants for subtle badges
        muted:
          "zd:border-transparent zd:bg-gray-100 zd:text-gray-800 zd:dark:bg-gray-800 zd:dark:text-gray-300",
        info:
          "zd:border-transparent zd:bg-sky-100 zd:text-sky-800 zd:dark:bg-sky-900/20 zd:dark:text-sky-400",
      },
      size: {
        default: "zd:px-2 zd:py-1",
        sm: "zd:text-[14px] zd:p-1 zd:px-2 zd:leading-none",
        lg: "zd:text-sm zd:px-3 zd:py-1.5",
        xl: "zd:text-base zd:px-4 zd:py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className ?? "")}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
