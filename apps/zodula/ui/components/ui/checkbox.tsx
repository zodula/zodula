import React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/zodula/ui/lib/utils";

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className = "", label, description, ...props }, ref) => (
  <div className="zd:flex zd:items-start zd:space-x-2">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "zd:cursor-pointer zd:peer zd:h-5 zd:w-5 zd:shrink-0 zd:rounded-sm zd:border zd:border-gray-300 zd:ring-offset-white zd:focus-visible:outline-none zd:focus-visible:ring-2 zd:focus-visible:ring-gray-950 zd:focus-visible:ring-offset-2 zd:disabled:cursor-not-allowed zd:disabled:opacity-50 zd:data-[state=checked]:bg-primary zd:data-[state=checked]:text-primary-foreground zd:dark:border-gray-800 zd:dark:ring-offset-primary zd:dark:focus-visible:ring-gray-300 zd:dark:data-[state=checked]:bg-primary zd:dark:data-[state=checked]:text-primary-foreground",
        className ?? ""
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("zd:flex zd:items-center zd:justify-center zd:text-current")}
      >
        <Check className="h-3 w-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    {(label || description) && (
      <div className="zd:grid zd:gap-1.5 zd:leading-none">
        {label && (
          <label
            htmlFor={props.id}
            className="zd:text-sm zd:font-medium zd:leading-none zd:peer-disabled:cursor-not-allowed zd:peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        {description && (
          <p className="zd:text-sm zd:text-gray-500 zd:dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    )}
  </div>
));

Checkbox.displayName = "Checkbox";

export { Checkbox };
