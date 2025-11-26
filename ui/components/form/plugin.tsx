import React from "react";
import { Input } from "../ui/input";

export class FormPlugin<FieldSupports extends string[] = string[]> {
    public types: FieldSupports = [] as unknown as FieldSupports;
    public render: ({
        fieldOptions,
        model,
        value,
        onChange,
        onBlur,
        readonly,
        multiple,
        fieldKey,
        formData,
        docId,
        fieldPath
    }: {
        fieldOptions: Zodula.Field;
        model?: any;
        value?: any;
        onChange?: (value: any) => void;
        onBlur?: (value: any) => void | Promise<void>;
        readonly?: boolean;
        multiple?: boolean;
        fieldKey?: string;
        formData?: any;
        docId: string;
        fieldPath?: string;
    }) => React.ReactNode;

    public cellRender: ({
        fieldOptions,
        value,
        doc,
        docId
    }: {
        fieldOptions: Zodula.Field;
        value?: any;
        doc?: any;
        docId?: string;
    }) => React.ReactNode;

    public renderFilter: ({
        fieldOptions,
        value,
        onChange,
        operator
    }: {
        fieldOptions: Zodula.Field;
        value?: any;
        onChange?: (value: any) => void;
        operator?: string;
    }) => React.ReactNode;

    constructor(
        types: FieldSupports,
        render: ({
            fieldOptions,
            model,
            value,
            onChange,
            onBlur,
            readonly,
            multiple,
            fieldKey,
            formData,
            docId
        }: {
            fieldOptions: Zodula.Field;
            model?: any;
            value?: any;
            onChange?: (value: any) => void;
            onBlur?: (value: any) => void | Promise<void>;
            readonly?: boolean;
            multiple?: boolean;
            fieldKey?: string;
            formData?: any;
            docId: string;
        }) => React.ReactNode,
        cellRender?: ({
            fieldOptions,
            value,
            doc,
            docId
        }: {
            fieldOptions: Zodula.Field;
            value?: any;
            doc?: any;
            docId?: string;
        }) => React.ReactNode,
        renderFilter?: ({
            fieldOptions,
            value,
            onChange,
            operator
        }: {
            fieldOptions: Zodula.Field;
            value?: any;
            onChange?: (value: any) => void;
            operator?: string;
        }) => React.ReactNode
    ) {
        this.types = types;
        this.render = render.bind(this);
        this.cellRender = cellRender || (({ value }) => {
            // Default cell render: show string value or dash if empty
            return value != null ? String(value) : <span className="zd:text-muted-foreground zd:italic">-</span>;
        });
        this.renderFilter = renderFilter || (({ value, onChange, operator }) => {
            // Default filter render: simple input for most field types
            if (["IS NULL", "IS NOT NULL"].includes(operator || "")) {
                return null; // No input needed for null checks
            }
            return (
                <Input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder="Enter value"
                />
            );
        });
    }
}