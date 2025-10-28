import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "../../lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className = "", inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "zd:flex zd:cursor-default zd:select-none zd:items-center zd:rounded-sm zd:px-2 zd:py-1.5 zd:outline-none zd:focus:bg-accent zd:data-[state=open]:zd:bg-accent",
      inset ? "zd:pl-8" : "",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="zd:ml-auto zd:h-4 zd:w-4" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className = "", ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "zd:z-50 zd:min-w-[8rem] zd:overflow-hidden zd:rounded-md zd:border zd:bg-popover zd:p-1 zd:text-popover-foreground zd:shadow-lg zd:data-[state=open]:zd:animate-in zd:data-[state=closed]:zd:animate-out zd:data-[state=closed]:zd:fade-out-0 zd:data-[state=open]:zd:fade-in-0 zd:data-[state=closed]:zd:zoom-out-95 zd:data-[state=open]:zd:zoom-in-95 zd:data-[side=bottom]:zd:slide-in-from-top-2 zd:data-[side=left]:zd:slide-in-from-right-2 zd:data-[side=right]:zd:slide-in-from-left-2 zd:data-[side=top]:zd:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className = "", sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "zd:z-50 zd:min-w-[8rem] zd:overflow-hidden zd:rounded-md zd:border zd:bg-popover zd:p-1 zd:text-popover-foreground zd:shadow-md zd:data-[state=open]:zd:animate-in zd:data-[state=closed]:zd:animate-out zd:data-[state=closed]:zd:fade-out-0 zd:data-[state=open]:zd:fade-in-0 zd:data-[state=closed]:zd:zoom-out-95 zd:data-[state=open]:zd:zoom-in-95 zd:data-[side=bottom]:zd:slide-in-from-top-2 zd:data-[side=left]:zd:slide-in-from-right-2 zd:data-[side=right]:zd:slide-in-from-left-2 zd:data-[side=top]:zd:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className = "", inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "zd:relative zd:flex zd:gap-2 zd:cursor-pointer zd:select-none zd:items-center zd:rounded-sm zd:px-2 zd:py-1.5 zd:outline-none zd:transition-colors zd:focus:bg-accent zd:focus:text-accent-foreground zd:data-[disabled]:pointer-events-none zd:data-[disabled]:opacity-50",
      inset ? "zd:pl-8" : "",
      "zd:hover:bg-accent zd:hover:text-accent-foreground",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className = "", children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "zd:relative zd:flex zd:cursor-default zd:select-none zd:items-center zd:rounded-sm zd:py-1.5 zd:pl-8 zd:pr-2 zd:outline-none zd:transition-colors zd:focus:bg-accent zd:focus:text-accent-foreground zd:data-[disabled]:zd:pointer-events-none zd:data-[disabled]:zd:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="zd:absolute zd:left-2 zd:flex zd:h-3.5 zd:w-3.5 zd:items-center zd:justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="zd:h-4 zd:w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className = "", children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "zd:relative zd:flex zd:cursor-default zd:select-none zd:items-center zd:rounded-sm zd:py-1.5 zd:pl-8 zd:pr-2 zd:outline-none zd:transition-colors zd:focus:bg-accent zd:focus:text-accent-foreground zd:data-[disabled]:zd:pointer-events-none zd:data-[disabled]:zd:opacity-50",
      className
    )}
    {...props}
  >
    <span className="zd:absolute zd:left-2 zd:flex zd:h-3.5 zd:w-3.5 zd:items-center zd:justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="zd:h-2 zd:w-2 zd:fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className = "", inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "zd:px-2 zd:py-1.5 zd:font-semibold",
      inset ? "zd:pl-8" : "",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className = "", ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("zd:-mx-1 zd:my-1 zd:h-px zd:bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("zd:ml-auto zd:text-xs zd:tracking-widest zd:opacity-60", className ?? "")}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}

