import { create } from 'zustand';

export interface FormAction {
    type: 'button' | 'dropdown';
    label?: string;
    icon?: React.ComponentType<any>;
    onClick?: () => void | Promise<void>;
    items?: Array<{
        label: string;
        icon?: React.ComponentType<any>;
        onClick: () => void | Promise<void>;
        disabled?: boolean;
    }>;
    disabled?: boolean;
    variant?: "outline" | "ghost" | "solid" | "subtle" | "success"
}

export interface FormActionsState {
    actions: Record<string, FormAction[]>;
    registerActions: (doctype: string, actions: FormAction[]) => void;
    getActions: (doctype: string) => FormAction[];
    clearActions: (doctype: string) => void;
    appendActions: (doctype: string, actions: FormAction[]) => void;
}

export const useFormActionsStore = create<FormActionsState>((set, get) => ({
    actions: {},

    registerActions: (doctype: string, actions: FormAction[]) => {
        set((state) => ({
            actions: {
                ...state.actions,
                [doctype]: actions
            }
        }));
    },

    getActions: (doctype: string) => {
        return get().actions[doctype] || [];
    },

    clearActions: (doctype: string) => {
        set((state) => {
            const newActions = { ...state.actions };
            delete newActions[doctype];
            return { actions: newActions };
        });
    },

    appendActions: (doctype: string, actions: FormAction[]) => {
        set((state) => ({
            actions: {
                ...state.actions,
                [doctype]: [...(state.actions[doctype] || []), ...actions]
            }
        }));
    }
}));

export const useFormActions = (doctype: string) => {
    const { getActions } = useFormActionsStore();
    return getActions(doctype);
};
