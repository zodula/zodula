import React from "react";
import { FormPlugin } from "../plugin";
import { Checkbox } from "../../ui/checkbox";

export const CheckboxPlugin = new FormPlugin(["Check"], (props) => {
    return (
        <Checkbox
            checked={props.value === 1}
            disabled={props.readonly}
            onCheckedChange={(checked: boolean | 'indeterminate') => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    const value = checked === true ? 1 : 0;
                    props.onChange?.(value);
                }
            }}
        />
    );
}, ({ value }) => {
    // Custom cell render for checkbox: show a visual checkbox
    return (
        <div className="zd:flex zd:items-center zd:justify-center">
            <Checkbox
                checked={value === 1}
                disabled={true}
                className="zd:pointer-events-none"
            />
        </div>
    );
}, (props) => {
    const value = parseInt(props.value);
    return (
        <Checkbox
            onChange={props.onChange}
            onCheckedChange={(checked: boolean | 'indeterminate') => {
                const __value = checked === true ? 1 : 0;
                props.onChange?.(__value?.toString());
            }}
            checked={value === 1}
        />
    );
});
