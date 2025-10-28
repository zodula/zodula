import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Select } from "../../ui/select";
import { Input } from "../../ui/input";

export const SelectPlugin = new FormPlugin(["Select"], (props) => {
    const options = useMemo(() => {
        return props.fieldOptions.options?.split?.("\n").map((option: string) => ({
            label: option,
            value: option,
        })) || [];
    }, [props.fieldOptions.options]);

    return (
        <Select
            multiple={props.multiple}
            placeholder={" "}
            value={props.value}
            options={options}
            searchable
            allowFreeText
            disabled={props.readonly}
            onChange={(value) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    props.onChange?.(value);
                }
            }}
        />
    );
}, (props) => {
    return <span className="zd:truncate zd:text-sm zd:bg-muted zd:rounded zd:px-2 zd:py-1">{String(props.value || "-")}</span>;
}, (props) => {
    const options = useMemo(() => {
        return props.fieldOptions.options?.split?.("\n").map((option: string) => ({
            label: option,
            value: option,
        })) || [];
    }, [props.fieldOptions.options]);

    // Don't render input for null operators
    if (["IS NULL", "IS NOT NULL"].includes(props.operator || "")) {
        return null;
    }

    // For IN/NOT IN operators, use a text input for comma-separated values
    if (["IN", "NOT IN"].includes(props.operator || "")) {
        return (
            <Input
                placeholder="comma-separated values"
                value={props.value || ""}
                onChange={(e) => props.onChange?.(e.target.value)}
                className="flex-1"
            />
        );
    }

    return (
        <Select
            multiple={false}
            placeholder="Select value"
            value={props.value}
            options={options}
            searchable
            allowFreeText
            onChange={(value) => props.onChange?.(value)}
            className="flex-1"
        />
    );
});
