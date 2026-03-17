import React from "react";
import { FormPlugin } from "../plugin";
import { DatePicker } from "../../custom/date-picker";

export const DateTimePlugin = new FormPlugin({
  types: ["DateTime", "Date", "Time"],
  supportOperators: ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"],
  render: (props) => {
    return (
      <DatePicker
        type={props.fieldOptions.type as "DateTime" | "Date" | "Time"}
        value={props.value}
        readOnly={props.readonly}
        range={props.multiple}
        onChange={(value) => {
          // Don't allow changes if readonly
          if (!props.readonly) {
            props.onChange?.(props.fieldPath || "", value);
          }
        }}
      />
    );
  },
  cellRender: ({ value, fieldOptions }) => {
    // Custom cell render for datetime: show formatted date/time
    if (!value)
      return <span className="zd:text-muted-foreground zd:italic">-</span>;
    
    try {
      return value
    } catch {
      return <span className="zd:text-muted-foreground zd:italic">-</span>;
    }
  },
  renderFilter: (props) => {
    return (
      <DatePicker
        type={props.fieldOptions.type as "DateTime" | "Date" | "Time"}
        value={props.value}
        onChange={(value) => {
          props.onChange?.(props.fieldPath || "", value);
        }}
      />
    );
  }
});
