import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CreateFormPersistenceState {
  // Store form values by doctype: { [doctype]: formValues }
  persistedForms: Record<string, Record<string, any>>;

  // Save form values for a doctype in create mode
  saveFormValues: (doctype: string, values: Record<string, any>) => void;

  // Get saved form values for a doctype
  getFormValues: (doctype: string) => Record<string, any> | null;

  // Clear saved form values for a doctype
  clearFormValues: (doctype: string) => void;

  // Clear all persisted forms
  clearAll: () => void;
}

// Create the Zustand store with persistence to localStorage
export const useCreateFormPersistenceStore = create<CreateFormPersistenceState>()(
    (set, get) => ({
      persistedForms: {},

      saveFormValues: (doctype: string, values: Record<string, any>) => {
        set((state) => {
          const newPersistedForms = { ...state.persistedForms };
          newPersistedForms[doctype] = { ...values };
          return { persistedForms: newPersistedForms };
        });
      },

      getFormValues: (doctype: string) => {
        const state = get();
        return state.persistedForms[doctype] || null;
      },

      clearFormValues: (doctype: string) => {
        set((state) => {
          const newPersistedForms = { ...state.persistedForms };
          delete newPersistedForms[doctype];
          return { persistedForms: newPersistedForms };
        });
      },

      clearAll: () => {
        set({ persistedForms: {} });
      },
    })
);



