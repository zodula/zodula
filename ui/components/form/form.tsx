import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Tabs, Section, FormControl } from "@/zodula/ui";
import { popup } from "@/zodula/ui";
import { useFormLayoutTabs } from "./form-layout";
import { useTranslation } from "../../hooks/use-translation";
import { useUIScript } from "@/zodula/ui/hooks/use-ui-script";
import { useRouter } from "../router";
import { zodula } from "@/zodula/client";

interface LayoutItem {
    type: string;
    value: string | string[];
    align: string;
    label_align: string;
}

interface TabConfig {
    label: string;
    layout: LayoutItem[] | LayoutItem[][];
}

interface FormProps<T extends Record<string, Zodula.Field>> {
    fields: T;
    values?: Partial<T>;
    onChange?: (fieldName: keyof T, value: any) => void;
    readonly?: boolean; // Form-level readonly (e.g., for system-generated models)
    docId?: string;
    doctype?: Zodula.DoctypeName;
    debug?: boolean; // Enable debug mode for System Admins
    tabs?: TabConfig[]; // Direct tab configuration for non-FormLayout forms
    translate?: boolean; // Enable/disable translation
    enableScripts?: boolean; // Enable client scripts
}

// Debug Component for Form Fields
const FormDebugDialog = ({
    isOpen,
    onClose,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        originalFields: Record<string, Zodula.Field>;
        mergedFields: Record<string, Zodula.Field>;
        layoutFields: any[];
        tabs: string[];
        sectionsByTab: any;
    }
}) => {
    if (!isOpen || !initialData) return null;

    const { originalFields, mergedFields, layoutFields, tabs, sectionsByTab } = initialData;

    return (
        <div className="zd:fixed zd:inset-0 zd:bg-black zd:bg-opacity-50 zd:flex zd:items-center zd:justify-center zd:z-50">
            <div className="zd:bg-white zd:rounded-lg zd:shadow-xl zd:max-w-6xl zd:max-h-[90vh] zd:w-full zd:mx-4 zd:overflow-hidden">
                <div className="zd:flex zd:items-center zd:justify-between zd:p-4 zd:border-b">
                    <h2 className="zd:text-xl zd:font-semibold">Form Debug - Field Inspector</h2>
                    <button
                        onClick={onClose}
                        className="zd:text-gray-500 zd:hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>

                <div className="zd:p-4 zd:overflow-y-auto zd:max-h-[calc(90vh-80px)]">


                    {/* Field Comparison Table */}
                    <div className="zd:mt-6">
                        <h3 className="zd:text-lg zd:font-medium zd:text-red-600 zd:mb-4">Field Comparison</h3>
                        <div className="zd:overflow-x-auto">
                            <table className="zd:w-full zd:text-sm zd:border-collapse zd:border zd:border-gray-300">
                                <thead>
                                    <tr className="zd:bg-gray-100">
                                        <th className="zd:border zd:border-gray-300 zd:p-2 zd:text-left">Field Key</th>
                                        <th className="zd:border zd:border-gray-300 zd:p-2 zd:text-left">Type</th>
                                        <th className="zd:border zd:border-gray-300 zd:p-2 zd:text-left">Label</th>
                                        <th className="zd:border zd:border-gray-300 zd:p-2 zd:text-left">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(mergedFields).map(([key, field]) => {
                                        const isLayoutField = layoutFields.some(lf => lf.id === key);
                                        const isOriginalField = key in originalFields;
                                        return (
                                            <tr key={key} className={isLayoutField ? 'zd:bg-green-50' : 'zd:bg-blue-50'}>
                                                <td className="border border-gray-300 p-2 font-mono">{key}</td>
                                                <td className="zd:border zd:border-gray-300 zd:p-2">{field.type}</td>
                                                <td className="zd:border zd:border-gray-300 zd:p-2">{field.label || '-'}</td>
                                                <td className="zd:border zd:border-gray-300 zd:p-2">
                                                    <span className={`px-2 py-1 rounded text-xs ${isLayoutField ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'
                                                        }`}>
                                                        {isLayoutField ? 'Layout' : 'Original'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper function to deep compare objects
const deepEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return obj1 === obj2;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
};

export const Form = <T extends Record<string, Zodula.Field>>(props: FormProps<T>) => {
    const [activeTab, setActiveTab] = useState<string>("");
    const { push } = useRouter();

    // Use direct tabs if provided, otherwise use registered layout
    const tabsToUse = props.tabs

    // Translation hook
    const { t } = useTranslation();

    // Track initial values to detect dirty state
    const initialValuesRef = useRef<Partial<T> | undefined>(undefined);
    const isDirtyRef = useRef<boolean>(false);
    const lastDocIdRef = useRef<string | undefined>(undefined);

    // Initialize and update initial values when values are loaded or docId changes
    useEffect(() => {
        // Update initial values when:
        // 1. Initial values haven't been set yet and values are available
        // 2. docId changes (new document loaded)
        const docIdChanged = lastDocIdRef.current !== props.docId;
        
        if (props.values !== undefined) {
            const shouldUpdate = 
                initialValuesRef.current === undefined || 
                (docIdChanged && props.docId !== undefined);
            
            if (shouldUpdate) {
                initialValuesRef.current = props.values ? JSON.parse(JSON.stringify(props.values)) : undefined;
                isDirtyRef.current = false;
                lastDocIdRef.current = props.docId;
            }
        }
    }, [props.values, props.docId]);

    // Calculate if form is dirty by comparing current values with initial values
    const isDirty = useMemo(() => {
        if (!props.values || initialValuesRef.current === undefined) {
            return false;
        }
        
        const currentValues = props.values;
        const initialValues = initialValuesRef.current;
        
        // Compare current values with initial values
        const dirty = !deepEqual(currentValues, initialValues);
        isDirtyRef.current = dirty;
        return dirty;
    }, [props.values]);

    // Handle beforeunload event to show confirmation when form is dirty
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirtyRef.current) {
                // Standard way to show confirmation dialog
                e.preventDefault();
                // For modern browsers
                e.returnValue = '';
                // Return a string for older browsers
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // Reset dirty state when form is successfully saved (when docId changes or values reset)
    useEffect(() => {
        // When values change but match initial values, reset dirty state
        if (initialValuesRef.current !== undefined && props.values) {
            if (deepEqual(props.values, initialValuesRef.current)) {
                isDirtyRef.current = false;
            }
        }
    }, [props.values]);

    // Client script hook
    const { execute } = useUIScript(props.doctype || '', {
        formData: props.values,
        setValue: props.onChange,
        getValue: (fieldName) => props.values?.[fieldName],
        getValues: () => props.values || {},
        docId: props.docId,
        isCreate: !props.values?.doc_status,
        showToast: (message, type) => {
            console.log(`${type}: ${message}`);
        },
        showDialog: async (component, dialogProps) => {
            return await popup(component, dialogProps);
        },
        navigate: (path) => push(path)
    });

    // Translation function - returns translated text if translate is true, otherwise returns original text
    const translateText = useCallback((text: string) => {
        return props.translate ? t(text) : text;
    }, [props.translate, t]);

    // Enhanced onChange handler that executes scripts
    const handleChange = useCallback(async (fieldName: keyof T, value: any) => {
        const oldValue = props.values?.[fieldName];

        // Create updated form data with the new value BEFORE calling onChange
        const updatedFormData = {
            ...props.values,
            [fieldName]: value
        };

        // Execute scripts if enabled (before calling onChange to avoid state timing issues)
        if (props.enableScripts !== false && props.doctype) {
            await execute('field_change', fieldName as string, {
                fieldName: fieldName as string,
                value,
                oldValue,
                formData: updatedFormData,
                // Override getValue to use the updated form data
                getValue: (fieldName: string) => updatedFormData[fieldName],
                getValues: () => updatedFormData
            });
        }

        // Call original onChange after scripts have run
        props.onChange?.(fieldName, value);
    }, [props.onChange, props.values, props.enableScripts, props.doctype]);

    // Execute form load scripts
    useEffect(() => {
        if (props.enableScripts !== false && props.doctype) {
            execute('form_load');
        }
    }, [props.enableScripts, props.doctype]);
    // Debug function for System Admins
    const openDebugDialog = async () => {
        if (!props.debug) return;

        const debugData = {
            originalFields: props.fields,
            mergedFields: props.fields,
            layoutFields: [],
            tabs,
            sectionsByTab
        };

        await popup(FormDebugDialog, {
            title: "Form Debug - Field Inspector",
            description: "Debug form fields and layout structure"
        }, debugData);
    };


    // Parse layout structure from tabs
    const { tabs, sectionsByTab, hasTabFields } = useMemo(() => {
        const tabs: string[] = [];
        const sectionsByTab: Record<string, Array<{
            sectionName: string;
            rows: Array<{
                fields: Array<{ key: string; field: Zodula.Field }>;
                columns: number;
            }>;
            collapsible: number;
            defaultCollapsed: number;
        }>> = {};

        // If using tabs (either direct or registered), parse them
        if (tabsToUse && tabsToUse.length > 0) {
            tabsToUse.forEach((tabConfig) => {
                const { label, layout } = tabConfig;
                tabs.push(label);
                sectionsByTab[label] = [];

                let currentSection = t("General");
                let currentRows: Array<{
                    fields: Array<{ key: string; field: Zodula.Field }>;
                    columns: number;
                }> = [];

                // Initialize first section
                sectionsByTab[label].push({
                    sectionName: currentSection,
                    rows: [],
                    collapsible: 1,
                    defaultCollapsed: 0
                });

                // Process layout items
                layout.forEach((item) => {
                    if (typeof item === 'object' && item !== null) {
                        const layoutItem = item as LayoutItem;

                        if (layoutItem.type === 'section') {
                            // Section header - save previous rows and start new section
                            if (currentRows.length > 0) {
                                const lastSectionIndex = (sectionsByTab[label]?.length || 0) - 1;
                                const lastSection = lastSectionIndex !== undefined ? sectionsByTab[label]?.[lastSectionIndex] : undefined;
                                if (lastSection) {
                                    lastSection.rows = [...currentRows];
                                }
                            }

                            currentSection = typeof layoutItem.value === 'string' ? layoutItem.value : (layoutItem.value[0] || '');
                            currentRows = [];

                            if (sectionsByTab[label]) {
                                sectionsByTab[label].push({
                                    sectionName: currentSection,
                                    rows: [],
                                    collapsible: 1,
                                    defaultCollapsed: 0
                                });
                            }
                        } else if (layoutItem.type === 'field' && layoutItem.value) {
                            // Standalone field - add it as a single-field row
                            const fieldName = typeof layoutItem.value === 'string' ? layoutItem.value : layoutItem.value[0];
                            if (fieldName && props.fields[fieldName]) {
                                currentRows.push({
                                    fields: [{
                                        key: fieldName,
                                        field: props.fields[fieldName]
                                    }],
                                    columns: 1
                                });
                            }
                        } else if (Array.isArray(item)) {
                            // Row array - process each field in the row
                            const rowFields: Array<{ key: string; field: Zodula.Field }> = [];
                            let validFieldCount = 0;

                            item.forEach((fieldItem) => {
                                if (typeof fieldItem === 'object' && fieldItem !== null) {
                                    const fieldLayoutItem = fieldItem as LayoutItem;

                                    if (fieldLayoutItem.type === 'field' && fieldLayoutItem.value) {
                                        const fieldName = typeof fieldLayoutItem.value === 'string' ? fieldLayoutItem.value : fieldLayoutItem.value[0];
                                        if (fieldName && props.fields[fieldName]) {
                                            rowFields.push({
                                                key: fieldName,
                                                field: props.fields[fieldName]
                                            });
                                            validFieldCount++;
                                        }
                                    } else if (fieldLayoutItem.type === 'empty') {
                                        // Empty field - add placeholder to maintain column positioning
                                        rowFields.push({
                                            key: `empty_${rowFields.length}`,
                                            field: { type: 'Data', label: '', required: 0, readonly: 1, hidden: 0 } as Zodula.Field
                                        });
                                    }
                                }
                            });

                            // Add row if it has any fields (including empty placeholders)
                            if (rowFields.length > 0) {
                                currentRows.push({
                                    fields: rowFields,
                                    columns: rowFields.length
                                });
                            }
                        }
                    }
                });

                // Add remaining rows to the last section
                if (currentRows.length > 0) {
                    const lastSectionIndex = sectionsByTab[label].length - 1;
                    const lastSection = sectionsByTab[label][lastSectionIndex];
                    if (lastSection) {
                        lastSection.rows = [...currentRows];
                    }
                }
            });

            // Add remaining fields that are not in the layout
            const usedFields = new Set<string>();
            Object.values(sectionsByTab).forEach(sections => {
                sections.forEach(section => {
                    section.rows.forEach(row => {
                        row.fields.forEach(({ key }) => {
                            usedFields.add(key);
                        });
                    });
                });
            });

            const remainingFields = Object.entries(props.fields)
                .filter(([key]) => !usedFields.has(key))
                .map(([key, field]) => ({ key, field }));

            if (remainingFields.length > 0) {
                // Add remaining fields to the last tab
                const lastTab = tabs[tabs.length - 1];
                if (lastTab && sectionsByTab[lastTab]) {
                    sectionsByTab[lastTab].push({
                        sectionName: t("Additional"),
                        rows: [{
                            fields: remainingFields,
                            columns: 1
                        }],
                        collapsible: 1,
                        defaultCollapsed: 0
                    });
                }
            }

            return {
                tabs: tabs.filter(tab => (sectionsByTab[tab]?.length || 0) > 0),
                sectionsByTab,
                hasTabFields: 1
            };
        }

        // Fallback: render all fields in a single tab if no tabs provided
        const allFields = Object.entries(props.fields).map(([key, field]) => ({
            key,
            field
        }));

        return {
            tabs: ["Main"],
            sectionsByTab: {
                "Main": [{
                    sectionName: t("General"),
                    rows: [{
                        fields: allFields,
                        columns: 1
                    }],
                    collapsible: 1,
                    defaultCollapsed: 0
                }]
            },
            hasTabFields: 0
        };
    }, [props.fields, tabsToUse]);

    // Set default active tab to the first tab when tabs change
    useEffect(() => {
        // Debounce setting the active tab to avoid rapid state changes
        const handler = setTimeout(() => {
            if (tabs.length > 0 && !activeTab) {
                setActiveTab(tabs[0] || "");
            }
        }, 200); // 150ms debounce

        return () => clearTimeout(handler);
    }, [tabs, activeTab]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
    };

    const isCreate = !props.values?.doc_status;

    if (tabs.length === 0) {
        return <div>{t("No fields")}</div>;
    }

    return (
        <div className="zd:space-y-6">
            {/* Debug Button for System Admins */}
            {/* {props.debug && (
                <div className="zd:fixed zd:bottom-4 zd:right-4 zd:justify-end zd:mb-4">
                    <button
                        onClick={openDebugDialog}
                        className="zd:px-3 zd:py-1 zd:bg-red-100 zd:text-red-700 zd:rounded zd:text-sm zd:hover:bg-red-200 zd:transition-colors"
                        title="Debug Form Fields (System Admin only)"
                    >
                        🐛 Debug Fields
                    </button>
                </div>
            )} */}

            {/* Only show tabs when Tab fields are explicitly defined */}
            {!!hasTabFields && (
                <Tabs
                    translate={props.translate}
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                />
            )}

            {sectionsByTab[activeTab]?.filter(({ rows }) => rows.length > 0).map(({ sectionName, rows, collapsible, defaultCollapsed }) => {
                return (
                    <Section
                        key={sectionName}
                        title={translateText(sectionName)}
                        hideLabel={sectionName === t("General")}
                        collapsible={collapsible === 1}
                        defaultCollapsed={defaultCollapsed === 1}
                    >
                        <div className="zd:space-y-4">
                            {rows.map(({ fields, columns }, rowIndex) => (
                                <div
                                    key={rowIndex}
                                    className={`zd:grid zd:gap-4 ${
                                        columns === 1 ? 'zd:grid-cols-1' :
                                        columns === 2 ? 'zd:grid-cols-2' :
                                        columns === 3 ? 'zd:grid-cols-3' :
                                        columns === 4 ? 'zd:grid-cols-4' :
                                        columns === 5 ? 'zd:grid-cols-5' :
                                        columns === 6 ? 'zd:grid-cols-6' :
                                        'zd:grid-cols-1'
                                    }`}
                                >
                                    {fields.map(({ key, field: _field }) => {
                                        const field = zodula.utils.getFormatFieldConfig(_field, props.values)
                                        const isFieldReadonly = (!isCreate && !!field.only_create) || !!field.readonly || props.readonly
                                        const isFieldRequired = field.required === 1

                                        // Handle empty fields - render as invisible placeholder
                                        if (key.startsWith('empty_')) {
                                            return (
                                                <div key={key} className="zd:opacity-0 zd:pointer-events-none">
                                                    <FormControl
                                                        formData={props.values}
                                                        docId={props.docId}
                                                        fieldKey={key as string}
                                                        field={field}
                                                        value=""
                                                        onChange={() => { }}
                                                        readonly={true}
                                                        label=""
                                                        required={false}
                                                        noPrint={true}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (field?.hidden === 1) {
                                            return null
                                        }
                                        return (
                                            <FormControl
                                                formData={props.values}
                                                docId={props.docId}
                                                key={key}
                                                fieldKey={key as string}
                                                field={field}
                                                value={props.values?.[key as keyof T]}
                                                onChange={handleChange}
                                                readonly={isFieldReadonly}
                                                label={translateText(field.label || key)}
                                                required={isFieldRequired}
                                                noPrint={field.no_print === 1 || props.values?.[key as keyof T] === undefined || props.values?.[key as keyof T] === null}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </Section>
                );
            })}
        </div>
    );
};