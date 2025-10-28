import React from "react";
import { FormPlugin } from "../plugin";
import { DatePicker } from "../../custom/date-picker";

export const DatetimePlugin = new FormPlugin(["Datetime", "Date", "Time"], (props) => {
    return (
        <DatePicker
            type={props.fieldOptions.type as "Datetime" | "Date" | "Time"}
            value={props.value}
            readOnly={props.readonly}
            range={props.multiple}
            onChange={(value) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    props.onChange?.(value);
                }
            }}
        />
    );
}, ({ value, fieldOptions }) => {
    // Custom cell render for datetime: show formatted date/time
    if (!value) return <span className="zd:text-muted-foreground zd:italic">-</span>;

    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return <span className="zd:text-muted-foreground zd:italic">-</span>;

        const type = fieldOptions.type;
        if (type === "Date") {
            return date.toLocaleDateString();
        } else if (type === "Time") {
            return date.toLocaleTimeString();
        } else {
            // Datetime
            return date.toLocaleString();
        }
    } catch {
        return <span className="zd:text-muted-foreground zd:italic">-</span>;
    }
}, props => {
    return <DatePicker
        type={props.fieldOptions.type as "Datetime" | "Date" | "Time"}
        value={props.value}
        onChange={(value) => {
            props.onChange?.(value);
        }}
    />
});
