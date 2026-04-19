import React from "react";
import { Input } from "../ui/input";
import type { IOperator } from "@/zodula/server/zodula/type";

export class FormPlugin<FieldSupports extends string[] = string[]> {
    public types: FieldSupports = [] as unknown as FieldSupports;
    public supportOperators?: IOperator[];
    public quickFilterOperator: IOperator = "=";
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
        fieldPath,
        doctype,
        compact
    }: {
        fieldOptions: Zodula.Field;
        model?: any;
        value?: any;
        onChange?: (fieldPath: string, value: any) => void;
        onBlur?: (fieldPath: string, value: any) => void | Promise<void>;
        readonly?: boolean;
        multiple?: boolean;
        fieldKey?: string;
        formData?: any;
        docId: string;
        fieldPath?: string;
        doctype?: Zodula.DoctypeConfig;
        compact?: boolean;
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
        operator,
        placeholder,
        fieldPath
    }: {
        fieldOptions: Zodula.Field;
        value?: any;
        onChange?: (fieldPath: string, value: any) => void;
        operator?: string;
        placeholder?: string;
        fieldPath?: string;
    }) => React.ReactNode;

    constructor(ctx: {
        types: FieldSupports;
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
            docId,
            fieldPath,
            doctype,
            placeholder,
            referenceTableFields,
            extendFields,
            referenceTableIndexFields,
            compact
        }: {
            fieldOptions: Zodula.Field;
            model?: any;
            value?: any;
            onChange?: (fieldPath: string, value: any) => void;
            onBlur?: (fieldPath: string, value: any) => void | Promise<void>;
            readonly?: boolean;
            multiple?: boolean;
            fieldKey?: string;
            formData?: any;
            docId: string;
            fieldPath?: string;
            doctype?: Zodula.DoctypeConfig;
            placeholder?: string;
            referenceTableFields?: Record<string, any>;
            extendFields?: Record<string, any>;
            referenceTableIndexFields?: Record<string, { idx: number, fields: Zodula.SelectDoctype<"Field">[]}[]>;
            compact?: boolean;
        }) => React.ReactNode;
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
        }) => React.ReactNode;
        renderFilter?: ({
            fieldOptions,
            value,
            onChange,
            operator,
            placeholder,
            fieldPath
        }: {
            fieldOptions: Zodula.Field;
            value?: any;
            onChange?: (fieldPath: string, value: any) => void;
            operator?: string;
            placeholder?: string;
            fieldPath?: string;
        }) => React.ReactNode;
        supportOperators?: IOperator[];
        quickFilterOperator?: IOperator;
    }) {
        this.types = ctx.types;
        this.supportOperators = ctx.supportOperators;
        this.quickFilterOperator = ctx.quickFilterOperator || "=";
        this.render = ctx.render.bind(this);
        this.cellRender = ctx.cellRender || (({ value }) => {
            // Default cell render: show string value or dash if empty
            return value != null ? String(value) : <span className="zd:text-muted-foreground zd:italic">-</span>;
        });
        this.renderFilter = ctx.renderFilter || (({ value, onChange, operator, placeholder, fieldPath }) => {
            // Default filter render: simple input for most field types
            if (["IS NULL", "IS NOT NULL"].includes(operator || "")) {
                return null; // No input needed for null checks
            }
            return (
                <Input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange?.(fieldPath || "", e.target.value)}
                    placeholder={placeholder || ""}
                />
            );
        });
    }
}