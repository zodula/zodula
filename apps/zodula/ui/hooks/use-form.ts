import { useCallback, useMemo, useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zodula } from '@/zodula/client';

interface FormValues<T extends Record<string, Zodula.Field>> {
  [key: string]: any;
}

// Form state store interface
interface FormState {
  forms: Record<string, any>;
  setFormValue: (formId: string, fieldName: string, value: any) => void;
  setFormValues: (formId: string, values: Record<string, any>) => void;
  resetForm: (formId: string) => void;
  clearForm: (formId: string) => void;
  clearAllForms: () => void;
}

// Create the Zustand store with optional persistence
const useFormStore = create<FormState>()(
  persist(
    (set) => ({
      forms: {},

      setFormValue: (formId: string, fieldName: string, value: any) => {
        set((state) => ({
          forms: {
            ...state.forms,
            [formId]: {
              ...state.forms[formId],
              [fieldName]: value,
            },
          },
        }));
      },

      setFormValues: (formId: string, values: Record<string, any>) => {
        set((state) => ({
          forms: {
            ...state.forms,
            [formId]: {
              ...state.forms[formId],
              ...values,
            },
          },
        }));
      },

      resetForm: (formId: string) => {
        set((state) => {
          const { [formId]: removed, ...rest } = state.forms;
          return { forms: rest };
        });
      },

      clearForm: (formId: string) => {
        set((state) => {
          const { [formId]: removed, ...rest } = state.forms;
          return { forms: rest };
        });
      },

      clearAllForms: () => {
        set({ forms: {} });
      },
    }),
    {
      name: 'zodula-form-storage',
      // Only persist forms that are explicitly marked for persistence
      partialize: (state) => ({ forms: {} }), // Don't persist by default
    }
  )
);

// Hook to use form state with ID
export function useForm<T extends Record<string, Zodula.Field>>(
  options?: {
    formId?: string;
    initialValues?: FormValues<T>;
    fields?: T;
    persist?: boolean; // New option to control persistence
    autoReset?: boolean; // New option to auto-reset on mount
  }
) {
  const { forms, setFormValue, setFormValues, resetForm, clearForm } = useFormStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Generate a unique formId if not provided
  const formId = useMemo(() => {
    return options?.formId || `form_${Math.random().toString(36).substr(2, 9)}`;
  }, [options?.formId]);

  // Get current form values
  const formData = useMemo(() => {
    const currentForm = forms[formId] || {};
    return options?.initialValues ? { ...options.initialValues, ...currentForm } : currentForm;
  }, [forms, formId, options?.initialValues]);

  // Calculate default values from field definitions
  const defaultValues = useMemo(() => {
    if (!options?.fields) return {};

    const values: Record<string, any> = {};
    Object.entries(options.fields).forEach(([fieldName, fieldOptions]) => {
      // Use zodula.utils.getDefaultValue to calculate default value
      const defaultValue = zodula.utils.getDefaultValue(fieldOptions);
      if (defaultValue !== undefined) {
        values[fieldName] = defaultValue;
      }
    });

    return values;
  }, [options?.fields]);

  // Auto-reset on mount if autoReset is true
  useEffect(() => {
    if (options?.autoReset && !isInitialized) {
      resetForm(formId);
      setIsInitialized(true);
    }
  }, [options?.autoReset, isInitialized, formId, resetForm]);

  // Set default values when fields are provided and form is empty
  useEffect(() => {
    if (options?.fields && Object.keys(defaultValues).length > 0) {
      const currentForm = forms[formId] || {};
      const hasValues = Object.keys(currentForm).length > 0;

      // Only set defaults if form is empty and we have default values
      if (!hasValues) {
        setFormValues(formId, defaultValues);
      }
    }
  }, [formId, defaultValues, options?.fields, forms, setFormValues]);

  // Handle field change
  const handleChange = useCallback((fieldName: keyof T, value: any) => {
    setFormValue(formId, fieldName as string, value);
  }, [formId, setFormValue]);

  // Reset form to initial values or default values
  const reset = useCallback(() => {
    resetForm(formId);
    // Re-apply default values after reset if fields are provided
    if (options?.fields && Object.keys(defaultValues).length > 0) {
      setTimeout(() => {
        setFormValues(formId, defaultValues);
      }, 0);
    }
  }, [formId, resetForm, options?.fields, defaultValues, setFormValues]);

  // Set single field value
  const setValue = useCallback((fieldName: keyof T, value: any) => {
    setFormValue(formId, fieldName as string, value);
  }, [formId, setFormValue]);

  // Set multiple field values
  const setValues = useCallback((values: Partial<FormValues<T>>) => {
    setFormValues(formId, values);
  }, [formId, setFormValues]);

  // Clear form completely
  const clear = useCallback(() => {
    clearForm(formId);
  }, [formId, clearForm]);

  return {
    formData,
    handleChange,
    reset,
    setValue,
    setValues,
    clear,
    formId,
    defaultValues,
  };
}

// Hook for completely isolated forms (no persistence, no sharing)
export function useIsolatedForm<T extends Record<string, Zodula.Field>>(
  options?: {
    initialValues?: FormValues<T>;
    fields?: T;
  }
) {
  const [formData, setFormData] = useState<FormValues<T>>(() => {
    return options?.initialValues || {};
  });

  // Calculate default values from field definitions
  const defaultValues = useMemo(() => {
    if (!options?.fields) return {};

    const values: Record<string, any> = {};
    Object.entries(options.fields).forEach(([fieldName, fieldOptions]) => {
      const defaultValue = zodula.utils.getDefaultValue(fieldOptions);
      if (defaultValue !== undefined) {
        values[fieldName] = defaultValue;
      }
    });

    return values;
  }, [options?.fields]);

  // Set default values on mount if no initial values
  useEffect(() => {
    if (options?.fields && Object.keys(defaultValues).length > 0 && !options?.initialValues) {
      setFormData(defaultValues);
    }
  }, [options?.fields, defaultValues, options?.initialValues]);

  // Handle field change
  const handleChange = useCallback((fieldName: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  // Reset form to initial values or default values
  const reset = useCallback(() => {
    const resetValues = options?.initialValues || defaultValues;
    setFormData(resetValues);
  }, [options?.initialValues, defaultValues]);

  // Set single field value
  const setValue = useCallback((fieldName: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  // Set multiple field values
  const setValues = useCallback((values: Partial<FormValues<T>>) => {
    setFormData(prev => ({
      ...prev,
      ...values,
    }));
  }, []);

  // Clear form completely
  const clear = useCallback(() => {
    setFormData({});
  }, []);

  return {
    formData,
    handleChange,
    reset,
    setValue,
    setValues,
    clear,
    defaultValues,
  };
}

// Utility hook to clear all forms (useful for logout, etc.)
export function useFormStoreUtils() {
  const { clearAllForms } = useFormStore();

  return {
    clearAllForms,
  };
}
