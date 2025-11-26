import React from "react";
import { FormPlugin } from "../plugin";
import MyEditor from "../../custom/editor";

export const EditorPlugin = new FormPlugin(["JSON", "Code"], (props) => {
    return (
        <MyEditor
            language={props.fieldOptions.type === "Code" ? props.fieldOptions?.options || "json" : undefined}
            readOnly={props.readonly}
            value={props.value}
            onChange={(value) => {
                props.onChange?.(value);
            }}
        />
    );
});
