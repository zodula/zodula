import React from "react";
import { FormPlugin } from "../plugin";
import { BASE_URL } from "@/zodula/client/utils";
import { Input } from "../../ui/input";
import { previewFile } from "../../custom/file-preview";

export const ImagePreviewPlugin = new FormPlugin({
    types: ["Image Preview"],
    render: (props) => {
        const width = props.fieldOptions.width || 250;
        const rawValue = props.value || "";
        const imageUrl =  props.value

        return (
            <div className="zd:space-y-2">
                {imageUrl && (
                    <button
                        type="button"
                        className="zd:inline-flex zd:flex-col zd:items-start zd:gap-1 zd:group no-print"
                        onClick={() => previewFile(rawValue)}
                    >
                        <img
                            src={imageUrl}
                            alt={props.fieldOptions.label || "Image Preview"}
                            style={{ width: `${width}px`, height: 'auto' }}
                            className="zd:rounded zd:border zd:border-border zd:transition-transform zd:group-hover:scale-[1.02]"
                        />
                        <span className="zd:text-xs zd:text-muted-foreground zd:opacity-80 zd:group-hover:opacity-100">
                            Click to preview
                        </span>
                    </button>
                )}
                {!props.readonly && (
                    <Input
                        type="text"
                        value={props.value || ""}
                        onChange={(e) => {
                            props.onChange?.(props.fieldPath || "", e.target.value);
                        }}
                        placeholder="Enter image file path"
                    />
                )}
            </div>
        );
    }
});

