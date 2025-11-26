import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Input } from "../../ui/input";

export const TextInputPlugin = new FormPlugin(["Text", "Password", "Integer", "Float", "Data", "Email"] as const, (props) => {
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

    // Normalize value to always be a string to prevent cursor jumping
    // When value is undefined/null, use empty string to match onChange behavior
    const inputValue = props.value ?? "";

    return (
        <Input
            placeholder={""}
            type={type}
            value={inputValue}
            readOnly={props.readonly}
            onChange={(e) => {
                const value = e.target.value;
                props.onChange?.(value);
            }}
        />
    );
}, (props) => {
    return <span className="zd:truncate">{String(props.value || "-")}</span>;
}, (props) => {
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
