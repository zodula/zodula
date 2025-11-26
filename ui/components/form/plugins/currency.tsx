import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Input } from "../../ui/input";
import { useDoc } from "@/zodula/ui/hooks/use-doc";

export const CurrencyPlugin = new FormPlugin(["Currency"], (props) => {
    const { doc: websiteSetting } = useDoc({
        doctype: "zodula__Global Setting",
        id: "zodula__Global Setting"
    })
    const formatCurrency = (value: any) => {
        if (value === null || value === undefined || value === "") return "";
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(numValue)) return "";
        return numValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const parseCurrency = (value: string) => {
        // Remove currency symbols and commas, then parse
        const cleaned = value.replace(/[$,]/g, "");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? "" : parsed;
    };

    const inputValue = useMemo(() => {
        if (props.value === null || props.value === undefined || props.value === "") return "";
        return formatCurrency(props.value);
    }, [props.value]);

    return (
        <Input
            placeholder="0.00"
            type="text"
            value={inputValue}
            readOnly={props.readonly}
            prefix={props?.fieldOptions?.currency_symbol || websiteSetting?.currency_symbol || "$"}
            onChange={(e) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    const parsed = parseCurrency(e.target.value);
                    props.onChange?.(parsed);
                }
            }}
        />
    );
}, (props) => {
    const { doc: websiteSetting } = useDoc({
        doctype: "zodula__Global Setting",
        id: "zodula__Global Setting"
    })
    // Custom cell render for currency: show formatted currency
    if (props.value === null || props.value === undefined || props.value === "") {
        return <span className="zd:text-muted-foreground zd:italic">-</span>;
    }

    const numValue = typeof props.value === "string" ? parseFloat(props.value) : props.value;
    if (isNaN(numValue)) {
        return <span className="zd:text-muted-foreground zd:italic">-</span>;
    }

    return (
        <span className="zd:truncate">
            {props?.fieldOptions?.currency_symbol || websiteSetting?.currency_symbol || "$"} {numValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}
        </span>
    );
}, (props) => {
    const { doc: websiteSetting } = useDoc({
        doctype: "zodula__Global Setting",
        id: "zodula__Global Setting"
    })
    const formatCurrency = (value: any) => {
        if (value === null || value === undefined || value === "") return "";
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(numValue)) return "";
        return numValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const parseCurrency = (value: string) => {
        // Remove currency symbols and commas, then parse
        const cleaned = value.replace(/[$,]/g, "");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? "" : parsed;
    };

    // Don't render input for null operators
    if (["IS NULL", "IS NOT NULL"].includes(props.operator || "")) {
        return null;
    }

    const inputValue = useMemo(() => {
        if (props.value === null || props.value === undefined || props.value === "") return "";
        return formatCurrency(props.value);
    }, [props.value]);

    return (
        <Input
            placeholder={getPlaceholder(props.operator)}
            type="text"
            value={inputValue}
            prefix={props?.fieldOptions?.currency_symbol || websiteSetting?.currency_symbol || "$"}
            onChange={(e) => {
                const parsed = parseCurrency(e.target.value);
                props.onChange?.(parsed);
            }}
            className="zd:flex-1"
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
    return "0.00";
}
