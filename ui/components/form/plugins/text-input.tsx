import React, { useMemo, useRef, useEffect, useState } from "react";
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

    const type = useMemo(() => {
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
    }, [props.fieldOptions.type]);

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
    }, [propValue, props.fieldKey]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      isUserTypingRef.current = true;
      setInternalValue(value);
      props.onChange?.(value);
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

    return (
      <Input
        ref={inputRef}
        name={props.fieldKey || ""}
        id={props.fieldKey || ""}
        placeholder={""}
        type={type}
        value={internalValue}
        readOnly={props.readonly}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
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
        placeholder={getPlaceholder(props.operator)}
        type={type}
        value={props.value || ""}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    );
  }
});

function getPlaceholder(operator?: string): string {
  if (["IN", "NOT IN"].includes(operator || "")) {
    return "comma-separated values";
  }
  if (["LIKE", "NOT LIKE"].includes(operator || "")) {
    return "use % as wildcard";
  }
  return "value";
}
