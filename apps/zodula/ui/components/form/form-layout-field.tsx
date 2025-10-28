import React, { useEffect } from 'react';
import { useFormLayout, type LayoutField, generateLayoutFieldId } from '../../hooks/use-form-layout';

interface FormLayoutFieldProps<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DN;
    position: 'below' | 'above' | 'replace';
    to: keyof Zodula.SelectDoctype<DN>;
    type: 'Section' | 'Tab' | 'Column';
    label?: string;
    // For Section type
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    // For Column type
    length?: number;
}

export const FormLayoutField = <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(
    { doctype, ...fieldProps }: FormLayoutFieldProps<DN>
) => {
    const { registerLayoutField, clearLayout } = useFormLayout(doctype);

    useEffect(() => {
        // Create a single field with auto-generated ID
        const field: LayoutField<DN> = {
            ...fieldProps,
            id: generateLayoutFieldId(fieldProps as any)
        };

        // Register the single field (adds to existing fields)
        registerLayoutField(field);
        
        // Clean up when component unmounts
        return () => {
            clearLayout();
        };
    }, [doctype]);

    // This component doesn't render anything, it just registers a single layout field
    return null;
};
