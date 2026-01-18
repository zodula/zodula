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

export const useUIScriptStore = create<UIScriptStore>((set, get) => ({
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

// Simplified Form object similar to Frappe's frm
export interface Form {
  doc: Record<string, any>;
  doctype: string;
  is_new: () => boolean;
  is_dirty: () => boolean;
  get_value: (fieldname: string) => any;
  set_value: (fieldname: string, value: any) => void;
  set_df_property: (fieldname: string, property: string, value: any) => void;
  get_doc: () => Record<string, any>;
  refresh: () => void;
  add_fetch: (source_field: string, target_field: string, fetch_path: string) => void;
  msgprint: (message: string, type?: 'error' | 'warning' | 'info') => void;
  // Field change specific
  docfield?: {
    fieldname: string;
    value: any;
    old_value: any;
  };
}

// Event types mapping
type EventType = 
  | 'refresh'
  | 'validate'
  | 'form_load'
  | 'field_change'
  | 'before_save'
  | 'after_save'
  | 'onload'
  | string;

type EventHandler = (frm: Form) => void | Promise<void>;
type EventHandlers = {
  [key: string]: EventHandler;
};

// Map Frappe-style event names to our event types
function mapEventType(eventType: string): string {
  const mapping: Record<string, string> = {
    'refresh': 'form_load',
    'validate': 'form_save',
    'onload': 'form_load',
    'before_save': 'form_save',
    'after_save': 'form_save',
    'field_change': 'field_change',
    'form_load': 'form_load',
  };
  
  return mapping[eventType] || eventType;
}

// Create Form object from context
function createFormObject(context: any): Form {
  const doc = context.getValues?.() || context.formData || {};
  
  return {
    doc,
    doctype: context.doctype || '',
    is_new: () => context.isCreate || false,
    is_dirty: () => {
      // Simple dirty check - can be enhanced
      return false;
    },
    get_value: (fieldname: string) => {
      return context.getValue?.(fieldname) ?? doc[fieldname];
    },
    set_value: (fieldname: string, value: any) => {
      context.setValue?.(fieldname, value);
      doc[fieldname] = value;
    },
    set_df_property: (fieldname: string, property: string, value: any) => {
      // This would need to be implemented in the form component
      // For now, we'll just log it
      console.log(`set_df_property(${fieldname}, ${property}, ${value})`);
    },
    get_doc: () => doc,
    refresh: () => {
      // Refresh would reload the form
      console.log('refresh() called');
    },
    add_fetch: (source_field: string, target_field: string, fetch_path: string) => {
      // This will be handled by the form component's fetch_from logic
      // fetch_from format: "source_field.fetch_path" (e.g., "from_address.province")
      // We just need to register it for documentation purposes
      console.log(`add_fetch(${source_field}, ${target_field}, ${fetch_path})`);
    },
    msgprint: (message: string, type: 'error' | 'warning' | 'info' = 'info') => {
      context.showToast?.(message, type);
    },
    // Field change specific
    docfield: context.fieldName ? {
      fieldname: context.fieldName,
      value: context.value,
      old_value: context.oldValue
    } : undefined
  };
}

// Singleton instance for UI scripting
class ZUI {
  private getStore() {
    return useUIScriptStore.getState();
  }

  form = {
    on: (doctype: string, eventOrFieldOrHandlers: EventType | EventHandlers | string, handler?: EventHandler) => {
      const { registerScript } = this.getStore();
      const knownEventTypes = ['refresh', 'validate', 'onload', 'before_save', 'after_save', 'form_load', 'field_change'];
      
      // Handle single event: zui.form.on('Task', 'validate', function(frm) { ... })
      if (typeof eventOrFieldOrHandlers === 'string' && typeof handler === 'function') {
        // Check if it's a known event type or a field name
        if (knownEventTypes.includes(eventOrFieldOrHandlers)) {
          // It's an event type
          const eventType = mapEventType(eventOrFieldOrHandlers);
          const scriptId = `${doctype}_${eventType}_${Date.now()}`;
          
          registerScript(doctype, {
            id: scriptId,
            doctype,
            name: `${doctype} ${eventType}`,
            events: [
              {
                type: eventType as any,
                action: async (context) => {
                  const frm = createFormObject(context);
                  await handler(frm);
                }
              }
            ]
          });
        } else {
          // It's a field name - treat as field_change
          const fieldName = eventOrFieldOrHandlers;
          const scriptId = `${doctype}_field_change_${fieldName}_${Date.now()}`;
          
          registerScript(doctype, {
            id: scriptId,
            doctype,
            name: `${doctype} field_change ${fieldName}`,
            events: [
              {
                type: 'field_change' as any,
                target: fieldName,
                action: async (context: any) => {
                  const frm = createFormObject(context);
                  await handler(frm);
                }
              }
            ]
          });
        }
      }
      // Handle multiple events: zui.form.on('Task', { refresh: function(frm) { ... }, customer: function(frm) { ... } })
      else if (typeof eventOrFieldOrHandlers === 'object' && !handler) {
        const scriptId = `${doctype}_multi_${Date.now()}`;
        const events: any[] = [];
        
        Object.entries(eventOrFieldOrHandlers).forEach(([key, eventHandler]) => {
          // Check if key is a known event type or a field name
          if (knownEventTypes.includes(key)) {
            // It's an event type
            const mappedEventType = mapEventType(key);
            events.push({
              type: mappedEventType as any,
              action: async (context: any) => {
                const frm = createFormObject(context);
                await eventHandler(frm);
              }
            });
          } else {
            // It's a field name - treat as field_change
            events.push({
              type: 'field_change' as any,
              target: key,
              action: async (context: any) => {
                const frm = createFormObject(context);
                await eventHandler(frm);
              }
            });
          }
        });
        
        registerScript(doctype, {
          id: scriptId,
          doctype,
          name: `${doctype} multiple events`,
          events
        });
      }
    }
  };
}

// Export singleton instance
export const zui = new ZUI();

