import React, { useEffect, useMemo, useState } from "react";
import { FormPlugin } from "../plugin";
import { Select, type SelectAction } from "../../ui/select";
import { ArrowRight, FilterIcon, PlusIcon } from "lucide-react";
import { Link, useRouter } from "../../router";
import { zodula } from "@/zodula/client";
import { cn } from "../../../lib/utils";

export const ReferencePlugin = new FormPlugin(["Reference", "Virtual Reference"], (props: {
    fieldOptions: Zodula.Field;
    value?: any;
    onChange?: (value: any) => void;
    onBlur?: (value: any) => void;
    readonly?: boolean;
    multiple?: boolean;
    fieldKey?: string;
    formData?: any;
    docId: string;
    fieldPath?: string;
}) => {
    const router = useRouter()
    const [options, setOptions] = useState<{ id: string, title: string, subtitle: string, doc: any }[]>([]);
    const [doctype, setDoctype] = useState<Zodula.SelectDoctype<"zodula__Doctype"> | null>(null)
    const [isFocused, setIsFocused] = useState(false)
    const isVirtual = props.fieldOptions.type === "Virtual Reference"
    const filters = useMemo(() => {
        try {
            return JSON.parse(props.fieldOptions.filters || "[]")
        } catch (e) {
            return []
        }
    }, [props.fieldOptions.filters])
    useEffect(() => {
        async function getDoctype() {
            if (!isFocused) return
            const reference = zodula.utils.getFieldValueFromDoc(props.fieldOptions.reference as string, props.formData, props.fieldOptions)
            if (!reference) return
            const doctype = await zodula.doc.get_doc("zodula__Doctype", reference as any, {})
            setDoctype(doctype)
        }
        getDoctype()
    }, [props.fieldOptions.reference, props.formData, isFocused])
    async function search(value: string) {
        if (!doctype) return
        const reference = zodula.utils.getFieldValueFromDoc(props.fieldOptions.reference as string, props.formData, props.fieldOptions)
        if (!reference) return
        const res = await zodula.doc.select_docs(reference as any, {
            q: value,
            limit: 10000,
            sort: "updated_at",
            order: "asc",
            filters: filters
        })
        setOptions(res.docs.map((r) => ({
            id: r.id,
            title: r[doctype.display_field || "id"] || r.id,
            subtitle: doctype.search_fields?.split("\n").map((field: string) => r[field]).join(", ") || "",
            doc: r.doc
        })))
    }
    useEffect(() => {
        if (!isFocused) return
        search(props.value || "")
    }, [props.value, isFocused, doctype])

    const referenceDoctype = zodula.utils.getFieldValueFromDoc(props.fieldOptions.reference as string, props.formData, props.fieldOptions)

    const actions = useMemo(() => {
        let _actions: SelectAction[] = []
        if (filters?.length > 0) {
            _actions.push({
                label: "",
                disabled: true,
                description: `
                ${filters.map((filter: any) => `${filter[0]} ${filter[1]} ${filter[2]}`).join(", ")}
                `,
                icon: <FilterIcon />,
                onClick: (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                }
            })
        }
        if (!doctype?.is_single && !doctype?.is_system_generated && !!referenceDoctype) {
            _actions.push({
                label: "Create",
                icon: <PlusIcon />,
                onClick: () => {
                    if (!referenceDoctype) return;
                    router.push(`/desk/doctypes/${referenceDoctype}/form`, {
                        state: {
                            cbUrl: window.location.pathname,
                            fromField: props.fieldPath || props.fieldKey,
                            fromDoc: props.formData
                        }
                    })
                }
            })
        }
        return _actions
    }, [doctype, props.fieldOptions.reference, referenceDoctype])
    return (
        <Select
            actions={actions}
            placeholder={""}
            value={props.value}
            options={options.map((option) => ({
                label: option.title,
                value: option.id,
                subtitle: option.subtitle,
        }))}
            onChange={(value) => {
                // Don't allow changes if readonly
                if (!props.readonly) {
                    props.onChange?.(value);
                }
            }}
            onFocus={() => {
                setIsFocused(true)
                if (!doctype) return
                if (!props.value || options.length === 0) {
                    search(props.value || "")
                }
            }}
            // onSelect={(option) => {
            //     props.onChange?.(option.value);
            // }}
            className={cn(
                "zd:rounded-md",
                !isVirtual ? "zd:hover:ring-primary zd:hover:ring-1" : ""
            )}
            onBlur={async () => {
                // Clear value if it doesn't match any existing option
                if (props.value && options.length <= 0) {
                    props.onChange?.("")
                }
                props.onBlur?.(props.value)
                setIsFocused(false)
            }}
            allowFreeText
            readOnly={props.readonly}
            suffix={<>
                {!!props.value && (
                    <Link to={`/desk/doctypes/${referenceDoctype || ""}/form/${props.value || ""}`} className="no-print">
                        <ArrowRight />
                    </Link>
                )}
            </>}
        />
    );
});
