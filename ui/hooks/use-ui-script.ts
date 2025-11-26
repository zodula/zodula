import { useCallback, useEffect, useMemo, useState } from "react";
import { create } from "zustand";

// Client Script Types
export interface UIScript {
  id: string;
  doctype: string;
  name: string;
  description?: string;
  events: UIScriptEvent[];
  dependencies?: string[];
  enabled?: boolean;
  priority?: number;
}

export interface UIScriptEvent {
  type: 'field_change' | 'form_load' | 'form_save' | 'form_reset' | 
        'field_focus' | 'field_blur' | 'list_load' | 'list_refresh' |
        'row_select' | 'row_click' | 'row_edit' | 'row_delete' |
        'button_click' | 'action_execute' | 'data_change' |
        'on_load' | 'on_render' | 'on_format';
  target?: string; // Field name, button name, action name, etc.
  condition?: (context: UIScriptContext) => boolean;
  action: (context: UIScriptContext) => void | Promise<void>;
  priority?: number;
}

export interface UIScriptContext {
  // Common context
  doctype: string;
  docId?: string;
  isCreate?: boolean;
  isEdit?: boolean;
  
  // Form context
  formData?: any;
  setValue?: (fieldName: string, value: any) => void;
  setValues?: (values: Record<string, any>) => void;
  getValue?: (fieldName: string) => any;
  getValues?: () => any;
  
  // List context
  listData?: any[];
  selectedRows?: Set<string>;
  setSelectedRows?: (selected: Set<string>) => void;
  refreshList?: () => void;
  
  // Event specific context
  fieldName?: string;
  value?: any;
  oldValue?: any;
  targetValue?: any;
  event?: Event;
  
  // UI context
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  showDialog?: (component: any, props: any) => Promise<any>;
  navigate?: (path: string) => void;
  
  // Formatting context
  originalValue?: any;
  formattedValue?: any;
  fieldType?: string;
  fieldOptions?: any;
  
  // Badge formatting context
  badgeConfig?: {
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    size: 'sm' | 'md' | 'lg';
    className?: string;
  };
  
  // Utility functions
  utils?: {
    formatCurrency: (value: number) => string;
    parseCurrency: (value: string) => number;
    formatDate: (date: Date | string) => string;
    parseDate: (date: string) => Date;
    calculateTotal: (items: any[], quantityField: string, priceField: string) => number;
  };
}

// Store implementation
interface UIScriptStore {
  scripts: Record<string, UIScript[]>;
  registerScript: (doctype: string, script: UIScript) => void;
  unregisterScript: (doctype: string, scriptId: string) => void;
  getScripts: (doctype: string) => UIScript[];
  clearScripts: (doctype?: string) => void;
  executeScripts: (doctype: string, eventType: string, context: Partial<UIScriptContext>) => Promise<void>;
}

const useUIScriptStore = create<UIScriptStore>((set, get) => ({
  scripts: {},
  
  registerScript: (doctype: string, script: UIScript) => {
    set((state) => ({
      scripts: {
        ...state.scripts,
        [doctype]: [...(state.scripts[doctype] || []), script]
      }
    }));
  },
  
  unregisterScript: (doctype: string, scriptId: string) => {
    set((state) => ({
      scripts: {
        ...state.scripts,
        [doctype]: (state.scripts[doctype] || []).filter(s => s.id !== scriptId)
      }
    }));
  },
  
  getScripts: (doctype: string) => {
    return get().scripts[doctype] || [];
  },
  
  clearScripts: (doctype?: string) => {
    if (doctype) {
      set((state) => {
        const newScripts = { ...state.scripts };
        delete newScripts[doctype];
        return { scripts: newScripts };
      });
    } else {
      set({ scripts: {} });
    }
  },
  
  executeScripts: async (doctype: string, eventType: string, context: Partial<UIScriptContext>) => {
    const scripts = get().scripts[doctype] || [];
    const enabledScripts = scripts.filter(script => script.enabled !== false);
    
    // Get all events for this event type
    const allEvents = enabledScripts.flatMap(script => script.events);
    const matchingEvents = allEvents
      .filter(event => event.type === eventType)
      .filter(event => !event.target || event.target === context.fieldName)
      .filter(event => !event.condition || event.condition(context as UIScriptContext))
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    
    // Execute events in order
    for (const event of matchingEvents) {
      try {
        await event.action(context as UIScriptContext);
      } catch (error) {
        console.error(`Client script error in ${doctype}:`, error);
      }
    }
  }
}));

// Main hook
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
  const register = useCallback((script: Omit<UIScript, 'doctype'>) => {
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

// Registry hook for shell
export function useUIScriptRegistry() {
  const { registerScript, unregisterScript, getScripts, clearScripts } = useUIScriptStore();
  
  return {
    registerScript,
    unregisterScript,
    getScripts,
    clearScripts
  };
}
