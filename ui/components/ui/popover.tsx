import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/zodula/ui/lib/utils"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "zd:bg-popover zd:text-popover-foreground zd:data-[state=open]:animate-in zd:data-[state=closed]:animate-out zd:data-[state=closed]:fade-out-0 zd:data-[state=open]:fade-in-0 zd:data-[state=closed]:zoom-out-95 zd:data-[state=open]:zoom-in-95 zd:data-[side=bottom]:slide-in-from-top-2 zd:data-[side=left]:slide-in-from-right-2 zd:data-[side=right]:slide-in-from-left-2 zd:data-[side=top]:slide-in-from-bottom-2 zd:z-50 zd:w-72 zd:origin-(--radix-popover-content-transform-origin) zd:rounded-md zd:border zd:p-4 zd:shadow-md zd:outline-hidden",
          className ?? ""
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
