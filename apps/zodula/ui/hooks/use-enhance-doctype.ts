import { useCallback } from 'react';
import { useFormActionsStore, type FormAction } from './use-form-actions';

interface UseEnhanceDoctypeOptions {
    doctype: string;
    doc?: any;
    formActions?: (params: { doc: any; doctype: string }) => FormAction[];
}

export function useEnhanceDoctype(options?: UseEnhanceDoctypeOptions) {
    const { registerActions, appendActions, getActions, clearActions, actions: formActions } = useFormActionsStore();

    const registerFormActions = useCallback((doctype: string, actions: FormAction[]) => {
        registerActions(doctype, actions);
    }, [registerActions]);

    const appendFormActions = useCallback((doctype: string, actions: FormAction[]) => {
        appendActions(doctype, actions);
    }, [appendActions]);

    const getFormActions = useCallback((doctype: string) => {
        return getActions(doctype);
    }, [getActions]);

    const clearFormActions = useCallback((doctype: string) => {
        clearActions(doctype);
    }, [clearActions]);

    // Auto-register actions if options are provided
    if (options?.doctype && options?.formActions) {
        const actions = options.formActions({
            doc: options.doc,
            doctype: options.doctype
        });
        registerActions(options.doctype, actions);
    }

    return {
        registerFormActions,
        appendFormActions,
        getFormActions,
        clearFormActions,
        formActions
    };
}
