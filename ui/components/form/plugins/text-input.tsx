import React, { useMemo, useRef, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FormPlugin } from "../plugin";
import { Input } from "../../ui/input";
import { cn } from "@/zodula/ui/lib/utils";

export const TextInputPlugin = new FormPlugin({
  types: ["Text", "Password", "Integer", "Float", "Data", "Email"] as const,
  render: (props) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isUserTypingRef = useRef(false);
    const prevPropValueRef = useRef<string>(props.value ?? "");

    // Initialize with prop value
    const [internalValue, setInternalValue] = useState<string>(() => {
      const initialValue = props.value ?? "";
      prevPropValueRef.current = initialValue;
      return initialValue;
    });

    const [showPassword, setShowPassword] = useState(false);
    const isPasswordField = props.fieldOptions.type === "Password";

    const type = useMemo(() => {
      if (isPasswordField && showPassword) return "text";
      switch (props.fieldOptions.type) {
        case "Password":
          return "password";
        case "Integer":
          return "number";
        case "Float":
          return "number";
        case "Email":
          return "email";
        default:
          return "text";
      }
    }, [props.fieldOptions.type, isPasswordField, showPassword]);

    // Normalize prop value
    const propValue = props.value ?? "";

    // Sync internal value with prop value only when:
    // 1. User is not actively typing (input doesn't have focus)
    // 2. The prop value actually changed from external source
    useEffect(() => {
      const propChanged = prevPropValueRef.current !== propValue;
      if (propChanged) {
        prevPropValueRef.current = propValue;

        // Only update if user is not actively typing
        if (!isUserTypingRef.current) {
          setInternalValue(propValue);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propValue, props.fieldPath]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      isUserTypingRef.current = true;
      setInternalValue(value);
      props.onChange?.(props.fieldPath || "", value);
    };

    const handleBlur = () => {
      isUserTypingRef.current = false;
      // Sync with prop value on blur in case it changed externally
      if (propValue !== internalValue) {
        setInternalValue(propValue);
      }
    };

    const handleFocus = () => {
      isUserTypingRef.current = true;
    };

    const passwordToggleSuffix = isPasswordField && !props.readonly ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShowPassword((v) => !v)}
        className="zd:flex zd:items-center zd:justify-center zd:p-0 zd:bg-transparent zd:border-none zd:cursor-pointer zd:hover:text-foreground zd:transition-colors"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeOff className="zd:h-4 zd:w-4" />
        ) : (
          <Eye className="zd:h-4 zd:w-4" />
        )}
      </button>
    ) : undefined;

    return (
      <Input
        ref={inputRef}
        name={props.fieldPath || ""}
        id={props.fieldPath || ""}
        placeholder={props.placeholder || ""}
        type={type}
        value={internalValue}
        readOnly={props.readonly}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        autocomplete={(props.fieldOptions as { autocomplete?: string }).autocomplete ?? "off"}
        suffix={passwordToggleSuffix}
      />
    );
  },
  cellRender: (props) => {
    return <span className="zd:truncate">{String(props.value || "-")}</span>;
  },
  renderFilter: (props) => {
    const type = useMemo(() => {
      switch (props.fieldOptions.type) {
        case "Password":
          return "password";
        case "Integer":
          return "number";
        case "Float":
          return "text";
        case "Email":
          return "email";
        default:
          return "text";
      }
    }, [props.fieldOptions.type]);

    // Don't render input for null operators
    if (["IS NULL", "IS NOT NULL"].includes(props.operator || "")) {
      return null;
    }

    return (
      <Input
        placeholder={props.placeholder || props.fieldOptions.label || ""}
        type={type}
        value={props.value || ""}
        onChange={(e) => props.onChange?.(props.fieldPath || "", e.target.value)}
      />
    );
  }
});