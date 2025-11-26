import * as React from "react";
import { cn } from "@/zodula/ui/lib/utils";
import {
  Calendar,
  Clock,
  Search
} from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string;
  prefix?: any;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", prefix, suffix, placeholder, disabled, readOnly, value, onChange, onFocus, onBlur, onKeyDown }, ref) => {
    const [showPassword] = React.useState(false);

    // Get appropriate icon based on input type
    const getTypeIcon = () => {
      switch (type) {
        case "date":
        case "datetime-local":
          return <Calendar className="zd:h-4 zd:w-4 zd:text-muted-foreground" />;
        case "time":
          return <Clock className="zd:h-4 zd:w-4 zd:text-muted-foreground" />;
        case "search":
          return <Search className="zd:h-4 zd:w-4 zd:text-muted-foreground" />;
        default:
          return null;
      }
    };

    // Get appropriate placeholder based on input type
    const getPlaceholder = () => {
      if (placeholder) return placeholder;

      switch (type) {
        case "date":
          return "dd/mm/yyyy";
        case "datetime-local":
          return "dd/mm/yyyy, --:--";
        case "time":
          return "--:--";
        default:
          return "";
      }
    };

    return (
      <div className={cn(
        "zd:flex zd:h-9 zd:w-full zd:rounded zd:px-3 zd:py-2 zd:items-center zd:gap-1",
        "zd:placeholder:text-muted-foreground/30 zd:focus-visible:outline-none",
        "zd:disabled:cursor-not-allowed",
        "zd:min-w-0",
        (disabled) ? "zd:bg-muted/50 zd:cursor-not-allowed" : "zd:bg-muted",
        (readOnly) ? "zd:bg-muted/50 zd:cursor-[default] zd:text-muted-foreground" : "zd:bg-muted",
        className ?? ""
      )}>
        {prefix && (
          <div className="zd:left-2 zd:text-muted-foreground">
            {prefix}
          </div>
        )}

        <input
          type={type === "password" && showPassword ? "text" : type}
          className="zd:flex-1 zd:min-w-0!"
          placeholder={getPlaceholder()}
          disabled={disabled}
          readOnly={readOnly}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          ref={ref}
        />

        {suffix && (
          <div className="zd:right-3 zd:text-muted-foreground">
            {suffix}
          </div>
        )}

        {/* Show type-specific icon if no custom suffix */}
        {!suffix && getTypeIcon() && (
          <div className="zd:absolute zd:right-3 zd:top-1/2 zd:transform zd:-translate-y-1/2 zd:text-muted-foreground zd:z-10">
            {getTypeIcon()}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
