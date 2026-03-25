import * as React from "react";
import { cn } from "@/zodula/ui/lib/utils";
import { Calendar, Clock, Search } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string;
  prefix?: any;
  suffix?: React.ReactNode;
  autocomplete?: "on" | "off" | "email" | "username" | "current-password" | "new-password" | string;
  wrapperStyle?: React.CSSProperties;
  /**
   * When true, suppresses the visual "read-only" styling (muted background,
   * muted text colour) even though the underlying input may have readOnly=true.
   * Use this when an input is functionally read-only (can't type) but should
   * still look like an interactive control — e.g. a Select without free-text.
   */
  suppressReadOnlyStyle?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      name,
      id,
      className,
      type = "text",
      prefix,
      suffix,
      placeholder,
      disabled,
      readOnly,
      suppressReadOnlyStyle = false,
      value,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      autocomplete = "off",
      wrapperStyle,
    },
    ref
  ) => {
    const [showPassword] = React.useState(false);

    // Get appropriate icon based on input type
    const getTypeIcon = () => {
      switch (type) {
        case "date":
        case "datetime-local":
          return (
            <Calendar className="zd:h-4 zd:w-4 zd:text-muted-foreground" />
          );
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
      <div
        className={cn(
          "zd:relative zd:flex zd:h-9 zd:w-full zd:rounded-lg zd:items-center",
          "zd:bg-muted",
          "zd:transition-colors zd:duration-150",
          "zd:focus-within:border-primary zd:focus-within:ring-2 zd:focus-within:ring-ring/20",
          "zd:min-w-0",
          disabled ? "zd:bg-muted/30 zd:cursor-not-allowed zd:opacity-60" : "",
          readOnly && !suppressReadOnlyStyle ? "zd:bg-muted/20" : "",
          className ?? ""
        )}
        style={wrapperStyle}
      >
        {prefix && (
          <div className="zd:pl-3 zd:text-muted-foreground zd:flex zd:items-center zd:shrink-0">{prefix}</div>
        )}

        <input
          name={name}
          id={id}
          type={type === "password" && showPassword ? "text" : type}
          className={cn(
            "zd:flex-1 zd:min-w-0! zd:px-3 zd:h-full zd:bg-transparent zd:outline-none zd:text-sm zd:placeholder:text-muted-foreground/50",
            prefix ? "zd:pl-1.5" : "",
            (suffix || getTypeIcon()) ? "zd:pr-1" : "",
            readOnly && !suppressReadOnlyStyle ? "zd:cursor-default zd:text-muted-foreground" : "zd:text-foreground",
          )}
          placeholder={getPlaceholder()}
          disabled={disabled}
          readOnly={readOnly}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          ref={ref}
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />

        {suffix && (
          <div className="zd:pr-3 zd:text-muted-foreground zd:flex zd:items-center zd:shrink-0">{suffix}</div>
        )}

        {/* Show type-specific icon if no custom suffix */}
        {!suffix && getTypeIcon() && (
          <div className="zd:pr-3 zd:flex zd:items-center zd:shrink-0 zd:text-muted-foreground">
            {getTypeIcon()}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
