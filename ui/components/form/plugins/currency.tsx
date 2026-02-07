import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Input } from "../../ui/input";
import { useDoc } from "@/zodula/ui/hooks/use-doc";

export const CurrencyPlugin = new FormPlugin({
    types: ["Currency"],
    supportOperators: ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"],
    render: (props) => {
    const { doc: websiteSetting } = useDoc({
        doctype: "zodula__Global Setting",
        id: "zodula__Global Setting"
    })
    return (
        <Input
            placeholder="0.00"
            type="text"
            value={props.value || ""}
            readOnly={props.readonly}
            prefix={websiteSetting?.currency_symbol || "$"}
            onChange={(e) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    props.onChange?.(e.target.value);
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
    const { doc: websiteSetting } = useDoc({
        doctype: "zodula__Global Setting",
        id: "zodula__Global Setting"
    })

    // Don't render input for null operators
    if (["IS NULL", "IS NOT NULL"].includes(props.operator || "")) {
        return null;
    }

    return (
        <Input
            placeholder={getPlaceholder(props.operator)}
            type="text"
            value={props.value || ""}
            prefix={websiteSetting?.currency_symbol || "$"}
            onChange={(e) => {
                props.onChange?.(e.target.value);
            }}
            className="zd:flex-1"
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
    return "0.00";
}
