import React from "react";
import { FormPlugin } from "../plugin";
import { Input } from "../../ui/input";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";

export const CurrencyPlugin = new FormPlugin({
    types: ["Currency"],
    supportOperators: ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"],
    render: (props) => {
    const { doc: globalSetting } = useDocAll({
        doctype: "Global Setting",
        id: "Global Setting",
    });
    return (
        <Input
            placeholder="0.00"
            type="text"
            value={props.value || ""}
            readOnly={props.readonly}
            prefix={globalSetting?.currency || "$"}
            onChange={(e) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    props.onChange?.(props.fieldPath || "", e.target.value);
                }
            }}
        />
    );
    },
    cellRender: (props) => {
    // Custom cell render for currency: show formatted currency
    if (props.value === null || props.value === undefined || props.value === "") {
        return <span className="zd:text-muted-foreground zd:italic">-</span>;
    }

    return <>{props.value}</>

    },
    renderFilter: (props) => {
    const { doc: globalSetting } = useDocAll({
        doctype: "Global Setting",
        id: "Global Setting",
    });

    // Don't render input for null operators
    if (["IS NULL", "IS NOT NULL"].includes(props.operator || "")) {
        return null;
    }

    return (
        <Input
            placeholder={props.placeholder || props.fieldOptions.label || "0.00"}
            type="text"
            value={props.value || ""}
            prefix={globalSetting?.currency || "$"}
            onChange={(e) => {
                props.onChange?.(props.fieldPath || "", e.target.value);
            }}
            className="zd:flex-1"
        />
    );
    }
});