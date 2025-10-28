import { create } from 'zustand';

export interface LayoutField<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    id?: string; // Optional - will be auto-generated if not provided
    position: 'below' | 'above' | 'replace';
    to: keyof Zodula.SelectDoctype<DN>; // field name to position relative to
    type: 'Section' | 'Tab' | 'Column';
    label?: string;
    // For Section type
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    // For Column type
    length?: number;
}

// Auto-generate ID for layout fields
export function generateLayoutFieldId(field: Omit<LayoutField, 'id'>): string {
    const label = field.label || field.type;
    const sanitizedLabel = label.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedLabel}_${field.type}_${field.position}_${field.to}`;
}

interface FormLayoutState<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    layouts: Record<string, LayoutField<DN>[]>; // doctype -> layout fields
    registerLayout: (doctype: string, fields: LayoutField<DN>[]) => void;
    registerLayoutField: (doctype: string, field: LayoutField<DN>) => void;
    getLayoutFields: (doctype: string) => LayoutField<DN>[];
    clearLayout: (doctype: string) => void;
}

export const useFormLayoutStore = create<FormLayoutState>((set, get) => ({
    layouts: {},

    registerLayout: (doctype: string, fields: LayoutField[]) => {
        set((state) => ({
            layouts: {
                ...state.layouts,
                [doctype]: fields
            }
        }));
    },

    registerLayoutField: (doctype: string, field: LayoutField) => {
        set((state) => ({
            layouts: {
                ...state.layouts,
                [doctype]: [...(state.layouts[doctype] || []), field]
            }
        }));
    },

    getLayoutFields: (doctype: string) => {
        return get().layouts[doctype] || [];
    },

    clearLayout: (doctype: string) => {
        set((state) => {
            const { [doctype]: removed, ...rest } = state.layouts;
            return { layouts: rest };
        });
    }
}));

export const useFormLayout = <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN) => {
    const { getLayoutFields, registerLayout, registerLayoutField, clearLayout } = useFormLayoutStore();

    return {
        layoutFields: getLayoutFields(doctype),
        registerLayout: (fields: LayoutField<DN>[]) => registerLayout(doctype, fields as any),
        registerLayoutField: (field: LayoutField<DN>) => registerLayoutField(doctype, field as any),
        clearLayout: () => clearLayout(doctype)
    };
};
