import React from "react";
import { FormPlugin } from "../plugin";
import { BASE_URL } from "@/zodula/client/utils";
import { Input } from "../../ui/input";

export const ImagePreviewPlugin = new FormPlugin({
    types: ["Image Preview"],
    render: (props) => {
        const width = props.fieldOptions.width || 250;
        const imageUrl = props.value 
            ? (props.value.startsWith('http') 
                ? props.value 
                : `${BASE_URL}${props.value.startsWith('/') ? props.value : `/${props.value}`}`)
            : null;

        return (
            <div className="zd:space-y-2">
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt={props.fieldOptions.label || "Image Preview"}
                        style={{ width: `${width}px`, height: 'auto' }}
                        className="zd:rounded zd:border zd:border-border"
                    />
                )}
                {!props.readonly && (
                    <Input
                        type="text"
                        value={props.value || ""}
                        onChange={(e) => {
                            props.onChange?.(e.target.value);
                        }}
                        placeholder="Enter image file path"
                    />
                )}
            </div>
        );
    }
});

