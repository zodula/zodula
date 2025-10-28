import React from "react";
import { FormPlugin } from "../plugin";
import { FileUpload } from "../../custom/file-upload";
import { BASE_URL } from "@/zodula/client/utils";

export const FileUploadPlugin = new FormPlugin(["File"], (props) => {
    const doctype = props.fieldOptions.doctype;
    const docId = props.docId || "";
    const fieldName = props.fieldOptions.name;
    const urlPrefix = [BASE_URL, "files", doctype, docId || doctype, fieldName, ""].join("/");
    return (
        <>
            <FileUpload
                readOnly={props.readonly}
                value={props.value}
                accept={props.fieldOptions.accept || ""}
                onChange={(value: File | string) => {
                    props.onChange?.(value);
                }}
                urlPrefix={urlPrefix}
            />
            {props.fieldOptions.accept && (
                <div className="zd:text-xs zd:text-muted-foreground zd:mt-2 no-print">
                    {props.fieldOptions.accept}
                </div>
            )}
        </>
    );
});
