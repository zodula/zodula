import React from "react";
import { FormPlugin } from "../plugin";
import { Textarea } from "../../ui/textarea";

export const TextareaPlugin = new FormPlugin(["Long Text"], (props) => {
    return (
        <Textarea
            placeholder={""}
            value={props.value}
            readOnly={props.readonly}
            onChange={(e) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    const value = e.target.value
                    props.onChange?.(value);
                }
            }}
        />
    );
});
