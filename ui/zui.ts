import { create } from "zustand";
import type { BadgeVariant } from "./components/ui/badge";
import type React from "react";
import { useLanguageStore, useTranslationStore } from "./hooks/use-translation";

// ============================================================================
// Type Definitions
// ============================================================================

// Client Script Types
export interface UIScript<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
  id: string;
  doctype: DN;
  name: string;
  description?: string;
  events: UIScriptEvent[];
  dependencies?: string[];
  enabled?: boolean;
  priority?: number;
}

export type UIScriptEventType = 
  | 'field_change' 
  | 'refresh'
  | 'form_save' 
  | 'field_focus' 
  | 'field_blur' 
  | 'list_load' 
  | 'list_refresh'
  | 'row_select' 
  | 'row_click' 
  | 'row_edit' 
  | 'row_delete' 
  | 'button_click' 
  | 'action_execute' 
  | 'data_change' 
  | 'on_load' 
  | 'on_render' 
  | 'on_format';

export interface UIScriptEvent<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
  type: UIScriptEventType;
  target?: string; // Field name, button name, action name, etc.
  condition?: (context: UIScriptContext<DN>) => boolean;
  action: (context: UIScriptContext<DN>) => void | Promise<void>;
  priority?: number;
}

export interface UIScriptContext<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
  // Common context
  doctype: DN;
  docId?: string;
  isCreate?: boolean;
  isEdit?: boolean;
  
  // Form context
  formData?: Partial<Zodula.SelectDoctype<DN>>;
  setValue?: (fieldName: string, value: any) => void;
  setValues?: (values: Record<string, any>) => void;
  getValue?: (fieldName: string) => any;
  getValues?: () => Partial<Zodula.SelectDoctype<DN>>;
  setFieldProperty?: (fieldName: string, property: string, value: any) => void;
  setChildExtendProperty?: (childField: string, fieldName: string, property: string, value: any) => void;
  setChildTableProperty?: (childField: string, idx: number | null, fieldName: string, property: string, value: any) => void;
  
  // Parent context (for child forms)
  parentContext?: FormContext<any>;
  
  // List context
  listData?: Zodula.SelectDoctype<DN>[];
  selectedRows?: Set<string>;
  setSelectedRows?: (selected: Set<string>) => void;
  refreshList?: () => void;
  
  // Event specific context
  fieldName?: string;
  value?: any;
  oldValue?: any;
  targetValue?: any;
  event?: Event;
  idx?: number; // Row index for reference table fields
  
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

// ============================================================================
// Store Implementation
// ============================================================================

interface UIScriptStore {
  scripts: Record<Zodula.DoctypeName, UIScript[]>;
  registerScript: <DN extends Zodula.DoctypeName>(doctype: DN, script: UIScript<DN>) => void;
  unregisterScript: <DN extends Zodula.DoctypeName>(doctype: DN, scriptId: string) => void;
  getScripts: <DN extends Zodula.DoctypeName>(doctype: DN) => UIScript[];
  clearScripts: (doctype?: Zodula.DoctypeName) => void;
  executeScripts: <DN extends Zodula.DoctypeName>(
    doctype: DN, 
    eventType: string, 
    context: Partial<UIScriptContext<DN>>
  ) => Promise<void>;
}

export const useUIScriptStore = create<UIScriptStore>((set, get) => ({
  scripts: {} as Record<Zodula.DoctypeName, UIScript[]>,
  
  registerScript: <DN extends Zodula.DoctypeName>(doctype: DN, script: UIScript<DN>) => {
    set((state) => ({
      scripts: {
        ...state.scripts,
        [doctype]: [...(state.scripts[doctype] || []), script]
      }
    }));
  },
  
  unregisterScript: <DN extends Zodula.DoctypeName>(doctype: DN, scriptId: string) => {
    set((state) => ({
      scripts: {
        ...state.scripts,
        [doctype]: (state.scripts[doctype] || []).filter(s => s.id !== scriptId)
      }
    }));
  },
  
  getScripts: <DN extends Zodula.DoctypeName>(doctype: DN) => {
    return get().scripts[doctype] || [];
  },
  
  clearScripts: (doctype?: Zodula.DoctypeName) => {
    if (doctype) {
      set((state) => {
        const newScripts = { ...state.scripts };
        delete newScripts[doctype];
        return { scripts: newScripts };
      });
    } else {
      set({ scripts: {} as Record<Zodula.DoctypeName, UIScript[]> });
    }
  },
  
  executeScripts: async <DN extends Zodula.DoctypeName>(
    doctype: DN, 
    eventType: string, 
    context: Partial<UIScriptContext<DN>>
  ) => {
    const scripts = get().scripts[doctype] || [];
    const enabledScripts = scripts.filter(script => script.enabled !== false);
    
    // Get all events for this event type
    const allEvents = enabledScripts.flatMap(script => script.events);
    const matchingEvents = allEvents
      .filter(event => event.type === eventType)
      .filter(event => !event.target || event.target === context.fieldName)
      .filter(event => !event.condition || event.condition(context as UIScriptContext<DN>))
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    
    // Execute events in order
    for (const event of matchingEvents) {
      try {
        await event.action(context as UIScriptContext<DN>);
      } catch (error) {
        console.error(`Client script error in ${doctype}:`, error);
      }
    }
  }
}));

// ============================================================================
// Form Object (Frappe-style)
// ============================================================================

export interface Form<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
  doc: Partial<Zodula.SelectDoctype<DN>>;
  doctype: DN;
  is_new: () => boolean;
  is_dirty: () => boolean;
  get_value: <K extends keyof Zodula.SelectDoctype<DN>>(fieldname: K) => Zodula.SelectDoctype<DN>[K] | undefined;
  set_value: <K extends keyof Zodula.SelectDoctype<DN>>(fieldname: K, value: Zodula.SelectDoctype<DN>[K]) => void;
  set_df_property: (fieldname: string, property: string, value: any) => void;
  set_df_child_extend_property: (childField: string, fieldName: string, property: string, value: any) => void;
  set_df_child_table_property: (childField: string, idx: number | null, fieldName: string, property: string, value: any) => void;
  parent: () => FormContext<any> | null;
  get_doc: () => Partial<Zodula.SelectDoctype<DN>>;
  refresh: () => void;
  add_fetch: (source_field: string, target_field: string, fetch_path: string) => void;
  msgprint: (message: string, type?: 'error' | 'warning' | 'info') => void;
  // Reference table helpers
  get_reference_table_value: (field: string, childField: string, idx: number) => any;
  set_reference_table_value: (field: string, childField: string, idx: number, value: any) => void;
  // Extend helpers
  get_extend_value: (field: string, childField: string) => any;
  set_extend_value: (field: string, childField: string, value: any) => void;
  // Field change specific
  docfield?: {
    fieldname: string;
    value: any;
    old_value: any;
  };
  idx?: number; // Row index for reference table fields
}

// ============================================================================
// Event Type Definitions
// ============================================================================

export type FormEventType = 
  | 'refresh'
  | 'validate'
  | 'field_change'
  | 'before_save'
  | 'after_save'
  | 'onload';

export type FormContextEventType = 'on_render' | 'on_format';

export type ListContextEventType = 'on_format' | 'on_render';

export type EventHandler<DN extends Zodula.DoctypeName = Zodula.DoctypeName> = (
  frm: Form<DN>
) => void | Promise<void>;

export type FormContextHandler<DN extends Zodula.DoctypeName = Zodula.DoctypeName> = (
  context: FormContext<DN>
) => void | Promise<void>;

export type ListContextHandler<DN extends Zodula.DoctypeName = Zodula.DoctypeName> = (
  context: ListContext<DN>
) => void | Promise<void>;

// Event handlers map types with field name support
export type FormEventHandlers<DN extends Zodula.DoctypeName = Zodula.DoctypeName> = {
  [K in FormEventType]?: EventHandler<DN>;
} & {
  // Field-specific handlers - keys are field names from the doctype
  [fieldName in keyof Zodula.SelectDoctype<DN>]?: EventHandler<DN>;
} & {
  // Allow any string for dynamic field names
  [fieldName: string]: EventHandler<DN>;
};

export type FormContextEventHandlers<DN extends Zodula.DoctypeName = Zodula.DoctypeName> = {
  [K in FormContextEventType]?: FormContextHandler<DN>;
};

export type ListContextEventHandlers<DN extends Zodula.DoctypeName = Zodula.DoctypeName> = {
  [K in ListContextEventType]?: ListContextHandler<DN>;
};

// ============================================================================
// Helper Functions
// ============================================================================

// Translation helper function
function translate(key: string): string {
  const languageStore = useLanguageStore.getState();
  const translationStore = useTranslationStore.getState();
  
  const activeLanguage = languageStore.currentLanguage;
  const translations = translationStore.translations;
  const translationCache = translationStore.translationCache;
  const patternCache = translationStore.patternCache;
  
  // Create cache key with language to avoid conflicts
  const cacheKey = `${activeLanguage}:${key}`;
  
  // Check cache first
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }
  
  // Helper function to get translation filtered by language
  const getTranslationByLanguage = (translationKey: string) => {
    return translations.find((translation) =>
      translation.key === translationKey &&
      translation.language === activeLanguage
    );
  };
  
  // Helper function to replace template variables in translation strings
  const replaceTemplateVariables = (template: string, variables: Record<string, string | number> = {}): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = variables[variableName];
      return value !== undefined ? String(value) : match;
    });
  };
  
  // Helper function to auto-detect variables from a string
  const autoDetectVariables = (inputString: string, translationKey: string): Record<string, string | number> => {
    const variables: Record<string, string | number> = {};
    
    // Extract template variables from the translation key
    const templateMatches = translationKey.match(/\{\{(\w+)\}\}/g);
    if (!templateMatches) return variables;
    
    // Extract the template pattern without variables
    const templatePattern = translationKey.replace(/\{\{(\w+)\}\}/g, '{{}}');
    
    // Create a regex pattern to match the input string
    const regexPattern = templatePattern.replace(/\{\{\}\}/g, '(.+?)');
    const regex = new RegExp(`^${regexPattern}$`);
    
    const match = inputString.match(regex);
    if (match) {
      // Extract variable names and their values
      templateMatches.forEach((templateVar, index) => {
        const varName = templateVar.replace(/\{\{|\}\}/g, '');
        const varValue = match[index + 1]; // +1 because match[0] is the full match
        if (varValue) {
          variables[varName] = varValue;
        }
      });
    }
    
    return variables;
  };
  
  // Helper function to find the best matching translation key
  const findBestTranslationKey = (inputString: string): string | null => {
    // First, try exact match with language filter
    const exactMatch = getTranslationByLanguage(inputString);
    if (exactMatch) return inputString;
    
    // Then, try to find a template pattern that matches with language filter
    for (const translation of translations) {
      if (translation.key.includes('{{') && translation.language === activeLanguage) {
        const templatePattern = translation.key.replace(/\{\{(\w+)\}\}/g, '{{}}');
        const regexPattern = templatePattern.replace(/\{\{\}\}/g, '(.+?)');
        const regex = new RegExp(`^${regexPattern}$`);
        
        if (regex.test(inputString)) {
          return translation.key;
        }
      }
    }
    
    return null;
  };
  
  // Find the best matching translation key
  const bestKey = findBestTranslationKey(key);
  const translation = bestKey ? getTranslationByLanguage(bestKey) : getTranslationByLanguage(key);
  const translationText = translation?.translation || key;
  
  // If we found a template-based translation, auto-detect variables
  if (bestKey && bestKey !== key && bestKey.includes('{{')) {
    // Check pattern cache for this input
    if (patternCache.has(cacheKey)) {
      const cached = patternCache.get(cacheKey)!;
      const result = replaceTemplateVariables(translationText, cached.variables);
      translationCache.set(cacheKey, result);
      return result;
    }
    
    const autoDetectedVars = autoDetectVariables(key, bestKey);
    const result = replaceTemplateVariables(translationText, autoDetectedVars);
    
    // Cache the pattern match and result
    patternCache.set(cacheKey, { key: bestKey, variables: autoDetectedVars });
    translationCache.set(cacheKey, result);
    return result;
  }
  
  // Cache the result
  translationCache.set(cacheKey, translationText);
  return translationText;
}

// Map Frappe-style event names to our event types
function mapEventType(eventType: string): UIScriptEventType {
  const mapping: Record<string, UIScriptEventType> = {
    'refresh': 'refresh',
    'validate': 'form_save',
    'onload': 'refresh',
    'before_save': 'form_save',
    'after_save': 'form_save',
    'field_change': 'field_change',
  };
  
  return mapping[eventType] || (eventType as UIScriptEventType);
}

// Create Form object from context
function createFormObject<DN extends Zodula.DoctypeName>(
  context: UIScriptContext<DN>
): Form<DN> {
  const doc = (context.getValues?.() || context.formData || {}) as Partial<Zodula.SelectDoctype<DN>>;
  
  return {
    doc,
    doctype: context.doctype,
    is_new: () => context.isCreate || false,
    is_dirty: () => {
      // Simple dirty check - can be enhanced
      return false;
    },
    get_value: <K extends keyof Zodula.SelectDoctype<DN>>(fieldname: K) => {
      return (context.getValue?.(fieldname as string) ?? doc[fieldname]) as Zodula.SelectDoctype<DN>[K] | undefined;
    },
    set_value: <K extends keyof Zodula.SelectDoctype<DN>>(fieldname: K, value: Zodula.SelectDoctype<DN>[K]) => {
      context.setValue?.(fieldname as string, value);
      (doc as any)[fieldname] = value;
    },
    set_df_property: (fieldname: string, property: string, value: any) => {
      // Call the setFieldProperty function from context if available
      if ((context as any).setFieldProperty) {
        (context as any).setFieldProperty(fieldname, property, value);
      } else {
        console.warn(`set_df_property(${fieldname}, ${property}, ${value}) - setFieldProperty not available in context`);
      }
    },
    set_df_child_extend_property: (childField: string, fieldName: string, property: string, value: any) => {
      // Call the setChildExtendProperty function from context if available
      if ((context as any).setChildExtendProperty) {
        (context as any).setChildExtendProperty(childField, fieldName, property, value);
      } else {
        console.warn(`set_df_child_extend_property(${childField}, ${fieldName}, ${property}, ${value}) - setChildExtendProperty not available in context`);
      }
    },
    set_df_child_table_property: (childField: string, idx: number | null, fieldName: string, property: string, value: any) => {
      // Call the setChildTableProperty function from context if available
      if ((context as any).setChildTableProperty) {
        (context as any).setChildTableProperty(childField, idx, fieldName, property, value);
      } else {
        console.warn(`set_df_child_table_property(${childField}, ${idx}, ${fieldName}, ${property}, ${value}) - setChildTableProperty not available in context`);
      }
    },
    parent: () => {
      // Return parent context if available
      return (context as any).parentContext || null;
    },
    get_doc: () => doc,
    refresh: () => {
      // Refresh would reload the form
      console.log('refresh() called');
    },
    add_fetch: (source_field: string, target_field: string, fetch_path: string) => {
      // This will be handled by the form component's fetch_from logic
      console.log(`add_fetch(${source_field}, ${target_field}, ${fetch_path})`);
    },
    msgprint: (message: string, type: 'error' | 'warning' | 'info' = 'info') => {
      // Map 'warning' to 'info' for showToast compatibility
      const toastType = type === 'warning' ? 'info' : type;
      context.showToast?.(message, toastType);
    },
    // Reference table helpers
    get_reference_table_value: (field: string, childField: string, idx: number) => {
      const tableData = context.getValue?.(field);
      if (Array.isArray(tableData) && tableData[idx]) {
        return tableData[idx][childField];
      }
      return undefined;
    },
    set_reference_table_value: (field: string, childField: string, idx: number, value: any) => {
      const tableData = context.getValue?.(field) || [];
      if (!Array.isArray(tableData)) return;
      
      const newTableData = [...tableData];
      if (!newTableData[idx]) {
        newTableData[idx] = {};
      }
      newTableData[idx] = {
        ...newTableData[idx],
        [childField]: value
      };
      context.setValue?.(field, newTableData);
    },
    // Extend helpers
    get_extend_value: (field: string, childField: string) => {
      const extendData = context.getValue?.(field);
      if (extendData && typeof extendData === 'object') {
        return extendData[childField];
      }
      return undefined;
    },
    set_extend_value: (field: string, childField: string, value: any) => {
      const extendData = context.getValue?.(field) || {};
      const newExtendData = {
        ...extendData,
        [childField]: value
      };
      context.setValue?.(field, newExtendData);
    },
    // Field change specific
    docfield: context.fieldName ? {
      fieldname: context.fieldName,
      value: context.value,
      old_value: context.oldValue
    } : undefined,
    idx: context.idx
  };
}

// ============================================================================
// Context Interfaces
// ============================================================================

export interface ListContext<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
  doctype: DN;
  listData: Zodula.SelectDoctype<DN>[];
  selectedRows: Set<string>;
  setSelectedRows: (selected: Set<string>) => void;
  refreshList: () => void;
  addColumn: (column: { key: string; label: string; render?: (doc: Zodula.SelectDoctype<DN>) => React.ReactNode }) => void;
  addBadge: (
    fieldName: keyof Zodula.SelectDoctype<DN> | string, 
    config: { 
      variant?: BadgeVariant['variant']; 
      size?: BadgeVariant['size']; 
      getValue?: (doc: Zodula.SelectDoctype<DN>) => any 
    }
  ) => void;
}

export interface FormContext<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
  doctype: DN;
  doc: Partial<Zodula.SelectDoctype<DN>>;
  isCreate: boolean;
  isEdit: boolean;
  getValue: <K extends keyof Zodula.SelectDoctype<DN>>(fieldName: K) => Zodula.SelectDoctype<DN>[K] | undefined;
  setValue: <K extends keyof Zodula.SelectDoctype<DN>>(fieldName: K, value: Zodula.SelectDoctype<DN>[K]) => void;
  addBadge: (
    fieldName: keyof Zodula.SelectDoctype<DN> | string, 
    config: { 
      variant?: BadgeVariant['variant']; 
      size?: BadgeVariant['size']; 
      getValue?: (doc: Partial<Zodula.SelectDoctype<DN>>) => any 
    }
  ) => void;
  addSecondaryButton: (
    label: string, 
    onClick: () => void | Promise<void>, 
    options?: {
      variant?: "outline" | "ghost" | "solid" | "subtle" | "success";
      icon?: React.ComponentType<any>;
      disabled?: boolean;
      items?: Array<{
        label: string;
        icon?: React.ComponentType<any>;
        onClick: () => void | Promise<void>;
        disabled?: boolean;
      }>;
    }
  ) => void;
  navigate: (path: string, options?: { state?: any }) => void;
  org?: string;
}

// ============================================================================
// ZUI Class - Type-Safe API
// ============================================================================

class ZUI {
  private getStore() {
    return useUIScriptStore.getState();
  }

  /**
   * Translation function for internationalization
   * @param key - The translation key or text to translate
   * @returns The translated text, or the key if no translation is found
   */
  t = (key: string): string => {
    return translate(key);
  };

  list = {
    on: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      eventOrHandlers: ListContextEventType | ListContextEventHandlers<DN>,
      handler?: ListContextHandler<DN>
    ): void => {
      const { registerScript } = this.getStore();
      
      // Handle single event: zui.list.on('Task', 'on_format', function(context) { ... })
      if (typeof eventOrHandlers === 'string' && typeof handler === 'function') {
        const eventType = eventOrHandlers;
        const scriptId = `${doctype}_list_${eventType}_${Date.now()}`;
        
        registerScript(doctype, {
          id: scriptId,
          doctype,
          name: `${doctype} list ${eventType}`,
          events: [
            {
              type: eventType,
              action: async (context: UIScriptContext) => {
                await handler(context as ListContext<DN>);
              }
            }
          ]
        });
      }
      // Handle multiple events: zui.list.on('Task', { on_format: function(context) { ... }, on_render: function(context) { ... } })
      else if (typeof eventOrHandlers === 'object' && !handler) {
        const scriptId = `${doctype}_list_multi_${Date.now()}`;
        const events: UIScriptEvent[] = [];
        
        Object.entries(eventOrHandlers).forEach(([key, eventHandler]) => {
          if (key === 'on_format' || key === 'on_render') {
          events.push({
              type: key as UIScriptEventType,
              action: async (context: UIScriptContext) => {
                await (eventHandler as ListContextHandler<DN>)(context as ListContext<DN>);
            }
          });
          }
        });
        
        registerScript(doctype, {
          id: scriptId,
          doctype,
          name: `${doctype} list multiple events`,
          events
        });
      }
    }
  };

  form = {
    on: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      eventOrFieldOrHandlers: 
        | FormEventType 
        | FormContextEventType
        | FormEventHandlers<DN> 
        | FormContextEventHandlers<DN>
        | keyof Zodula.SelectDoctype<DN> // Field name
        | string, // Fallback for dynamic field names
      handler?: EventHandler<DN> | FormContextHandler<DN>
    ): void => {
      const { registerScript } = this.getStore();
      const knownEventTypes: readonly string[] = ['refresh', 'validate', 'onload', 'before_save', 'after_save', 'field_change', 'on_render', 'on_format'] as const;
      
      // Handle single event: zui.form.on('Task', 'validate', function(frm) { ... })
      // or zui.form.on('Task', 'on_render', function(context) { ... })
      if (typeof eventOrFieldOrHandlers === 'string' && typeof handler === 'function') {
        // Check if it's a context-based event (on_render, on_format)
        if (eventOrFieldOrHandlers === 'on_render' || eventOrFieldOrHandlers === 'on_format') {
          const eventType = eventOrFieldOrHandlers as FormContextEventType;
          const scriptId = `${doctype}_form_${eventType}_${Date.now()}`;
          
          registerScript(doctype, {
            id: scriptId,
            doctype,
            name: `${doctype} form ${eventType}`,
            events: [
              {
                type: eventType,
                action: async (context: UIScriptContext) => {
                  await (handler as FormContextHandler<DN>)(context as FormContext<DN>);
                }
              }
            ]
          });
        }
        // Check if it's a known event type
        else if (knownEventTypes.includes(eventOrFieldOrHandlers)) {
          // It's an event type
          const eventType = mapEventType(eventOrFieldOrHandlers) as UIScriptEventType;
          const scriptId = `${doctype}_${eventType}_${Date.now()}`;
          
          registerScript(doctype, {
            id: scriptId,
            doctype,
            name: `${doctype} ${eventType}`,
            events: [
              {
                type: eventType,
                action: async (context: UIScriptContext) => {
                  const frm = createFormObject(context as UIScriptContext<DN>);
                  await (handler as EventHandler<DN>)(frm);
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
                type: 'field_change',
                target: fieldName,
                action: async (context: UIScriptContext) => {
                  const frm = createFormObject(context as UIScriptContext<DN>);
                  await (handler as EventHandler<DN>)(frm);
                }
              }
            ]
          });
        }
      }
      // Handle multiple events: zui.form.on('Task', { refresh: function(frm) { ... }, customer: function(frm) { ... } })
      // or zui.form.on('Task', { on_render: function(context) { ... } })
      else if (typeof eventOrFieldOrHandlers === 'object' && !handler) {
        const scriptId = `${doctype}_multi_${Date.now()}`;
        const events: UIScriptEvent[] = [];
        
        Object.entries(eventOrFieldOrHandlers).forEach(([key, eventHandler]) => {
          // Check if it's a context-based event (on_render, on_format)
          if (key === 'on_render' || key === 'on_format') {
            events.push({
              type: key as UIScriptEventType,
              action: async (context: UIScriptContext) => {
                await (eventHandler as FormContextHandler<DN>)(context as FormContext<DN>);
              }
            });
          }
          // Check if key is a known event type
          else if (knownEventTypes.includes(key)) {
            // It's an event type
            const mappedEventType = mapEventType(key);
            events.push({
              type: mappedEventType,
              action: async (context: UIScriptContext) => {
                const frm = createFormObject(context as UIScriptContext<DN>);
                await (eventHandler as EventHandler<DN>)(frm);
              }
            });
          } else {
            // It's a field name - treat as field_change
            events.push({
              type: 'field_change',
              target: key,
              action: async (context: UIScriptContext) => {
                const frm = createFormObject(context as UIScriptContext<DN>);
                await (eventHandler as EventHandler<DN>)(frm);
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

// Export types for use in UI files
export type { Form as FormType };
