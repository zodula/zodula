import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/zodula/ui/lib/utils"

const badgeVariants = cva(
  "zd:inline-flex zd:items-center zd:justify-center zd:rounded-full zd:w-fit zd:whitespace-nowrap zd:shrink-0 [&>svg]:size-3 zd:gap-1 [&>svg]:pointer-events-none zd:transition-colors zd:overflow-hidden zd:h-fit zd:font-medium",
  {
    variants: {
      variant: {
        default:
          "zd:bg-primary zd:text-primary-foreground zd:[a&]:hover:bg-primary/90",
        secondary:
          "zd:bg-secondary zd:text-secondary-foreground zd:[a&]:hover:bg-secondary/80",
        destructive:
          "zd:bg-red-100 zd:text-red-700 zd:dark:bg-red-900/30 zd:dark:text-red-400",
        warning:
          "zd:bg-amber-100 zd:text-amber-700 zd:dark:bg-amber-900/30 zd:dark:text-amber-400",
        success:
          "zd:bg-emerald-100 zd:text-emerald-700 zd:dark:bg-emerald-900/30 zd:dark:text-emerald-400",
        outline:
          "zd:border zd:border-border zd:text-foreground zd:bg-transparent zd:[a&]:hover:bg-accent",
        // Status-specific variants
        draft:
          "zd:bg-red-100 zd:text-red-700 zd:dark:bg-red-900/30 zd:dark:text-red-400",
        submitted:
          "zd:bg-emerald-100 zd:text-emerald-700 zd:dark:bg-emerald-900/30 zd:dark:text-emerald-400",
        cancelled:
          "zd:bg-zinc-100 zd:text-zinc-600 zd:dark:bg-zinc-800 zd:dark:text-zinc-400",
        pending:
          "zd:bg-blue-100 zd:text-blue-700 zd:dark:bg-blue-900/30 zd:dark:text-blue-400",
        approved:
          "zd:bg-emerald-100 zd:text-emerald-700 zd:dark:bg-emerald-900/30 zd:dark:text-emerald-400",
        rejected:
          "zd:bg-rose-100 zd:text-rose-700 zd:dark:bg-rose-900/30 zd:dark:text-rose-400",
        muted:
          "zd:bg-muted zd:text-muted-foreground",
        info:
          "zd:bg-sky-100 zd:text-sky-700 zd:dark:bg-sky-900/30 zd:dark:text-sky-400",
      },
      size: {
        default: "zd:px-3 zd:py-1 zd:leading-none",
        sm: "zd:text-sm zd:px-2 zd:py-1 zd:leading-none",
        lg: "zd:text-lg zd:px-4 zd:py-2",
        xl: "zd:text-lg zd:px-4 zd:py-2",
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
  size = "sm",
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

type BadgeVariant = VariantProps<typeof badgeVariants>

export { Badge, badgeVariants, type BadgeVariant }
