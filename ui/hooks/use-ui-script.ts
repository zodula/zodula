import { useCallback, useMemo } from "react";
import { useUIScriptStore, type UIScriptContext } from "../zui";

// Main hook for executing scripts
export function useUIScript(doctype: string, options?: {
  // Form options
  formData?: any;
  setValue?: (fieldName: string, value: any) => void;
  setValues?: (values: Record<string, any>) => void;
  getValue?: (fieldName: string) => any;
  getValues?: () => any;
  
  // List options
  listData?: any[];
  selectedRows?: Set<string>;
  setSelectedRows?: (selected: Set<string>) => void;
  refreshList?: () => void;
  
  // UI options
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  showDialog?: (component: any, props: any) => Promise<any>;
  navigate?: (path: string) => void;
  
  // Common options
  docId?: string;
  isCreate?: boolean;
  isEdit?: boolean;
}) {
  const { scripts, registerScript, unregisterScript, getScripts, executeScripts } = useUIScriptStore();
  
  // Get scripts for this doctype
  const doctypeScripts = useMemo(() => {
    return getScripts(doctype).filter(script => script.enabled !== false);
  }, [doctype, scripts]);
  
  // Create enhanced context with utilities
  const createContext = useCallback((eventType: string, target?: string, additionalContext?: any): UIScriptContext => {
    return {
      doctype,
      docId: options?.docId,
      isCreate: options?.isCreate || false,
      isEdit: options?.isEdit || false,
      
      // Form context
      formData: options?.formData || {},
      setValue: options?.setValue,
      setValues: options?.setValues,
      getValue: options?.getValue,
      getValues: options?.getValues,
      
      // List context
      listData: options?.listData || [],
      selectedRows: options?.selectedRows,
      setSelectedRows: options?.setSelectedRows,
      refreshList: options?.refreshList,
      
      // UI context
      showToast: options?.showToast,
      showDialog: options?.showDialog,
      navigate: options?.navigate,
      
      // Event specific
      ...additionalContext,
      
      // Utilities
      utils: {
        formatCurrency: (value: number) => value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        parseCurrency: (value: string) => {
          const cleaned = value.replace(/[$,]/g, "");
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        },
        formatDate: (date: Date | string) => {
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleDateString();
        },
        parseDate: (date: string) => new Date(date),
        calculateTotal: (items: any[], quantityField: string, priceField: string) => {
          return items.reduce((total, item) => {
            const quantity = parseFloat(item[quantityField]) || 0;
            const price = parseFloat(item[priceField]) || 0;
            return total + (quantity * price);
          }, 0);
        }
      }
    };
  }, [doctype, options]);
  
  // Execute scripts for an event
  const execute = useCallback(async (
    eventType: string,
    target?: string,
    additionalContext?: any
  ) => {
    const context = createContext(eventType, target, additionalContext);
    await executeScripts(doctype, eventType, context);
  }, [doctype, createContext, executeScripts]);
  
  // Register script
  const register = useCallback((script: Omit<import("../zui").UIScript, 'doctype'>) => {
    registerScript(doctype, { ...script, doctype });
  }, [doctype, registerScript]);
  
  // Unregister script
  const unregister = useCallback((scriptId: string) => {
    unregisterScript(doctype, scriptId);
  }, [doctype, unregisterScript]);
  
  return {
    scripts: doctypeScripts,
    register,
    unregister,
    execute,
    createContext
  };
}

