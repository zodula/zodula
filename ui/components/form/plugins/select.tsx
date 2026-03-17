import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Select } from "../../ui/select";
import { Input } from "../../ui/input";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

export const SelectPlugin = new FormPlugin({
    types: ["Select"],
    supportOperators: ["=", "!=", "IN", "NOT IN", "IS NULL", "IS NOT NULL"],
    render: (props) => {
        const { t } = useTranslation();
        const options = useMemo(() => {
            return props.fieldOptions.options?.split?.("\n").map((option: string) => ({
                label: t(option),
                value: option,
            })) || [];
        }, [props.fieldOptions.options, t]);

        return (
            <Select
                multiple={props.multiple}
                placeholder={" "}
                displayMode="label"
                value={props.value}
                options={options}
                disabled={props.readonly}
                onChange={(value) => {
                    // Don't allow changes if readonly
                    if (!props.readonly) {
                        props.onChange?.(props.fieldPath || "", value);
                    }
                }}
            />
        );
    },
    cellRender: (props) => {
        const { t } = useTranslation();
        return <span className="zd:truncate zd:text-sm zd:bg-muted zd:rounded zd:px-2 zd:py-1">{t(String(props.value || "-"))}</span>;
    },
    renderFilter: (props) => {
        const { t } = useTranslation();
        const options = useMemo(() => {
            return props.fieldOptions.options?.split?.("\n").map((option: string) => ({
                label: t(option),
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
                    onChange={(e) => props.onChange?.(props.fieldPath || "", e.target.value)}
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
                displayMode="label"
                searchable
                allowFreeText
                onChange={(value) => props.onChange?.(props.fieldPath || "", value)}
                className="flex-1"
            />
        );
    }
});
