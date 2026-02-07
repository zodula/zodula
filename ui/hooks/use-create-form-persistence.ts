import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CreateFormPersistenceState {
  // Store form values by doctype and org: { [doctype]: { [org]: formValues } }
  persistedForms: Record<string, Record<string, Record<string, any>>>;
  
  // Save form values for a doctype in create mode
  saveFormValues: (doctype: string, org: string, values: Record<string, any>) => void;
  
  // Get saved form values for a doctype
  getFormValues: (doctype: string, org: string) => Record<string, any> | null;
  
  // Clear saved form values for a doctype
  clearFormValues: (doctype: string, org: string) => void;
  
  // Clear all persisted forms
  clearAll: () => void;
}

// Create the Zustand store with persistence to localStorage
export const useCreateFormPersistenceStore = create<CreateFormPersistenceState>()(
  persist(
    (set, get) => ({
      persistedForms: {},

      saveFormValues: (doctype: string, org: string, values: Record<string, any>) => {
        set((state) => {
          const newPersistedForms = { ...state.persistedForms };
          if (!newPersistedForms[doctype]) {
            newPersistedForms[doctype] = {};
          }
          newPersistedForms[doctype][org] = { ...values };
          return { persistedForms: newPersistedForms };
        });
      },

      getFormValues: (doctype: string, org: string) => {
        const state = get();
        return state.persistedForms[doctype]?.[org] || null;
      },

      clearFormValues: (doctype: string, org: string) => {
        set((state) => {
          const newPersistedForms = { ...state.persistedForms };
          if (newPersistedForms[doctype]?.[org]) {
            delete newPersistedForms[doctype][org];
            // Clean up empty doctype entries
            if (Object.keys(newPersistedForms[doctype]).length === 0) {
              delete newPersistedForms[doctype];
            }
          }
          return { persistedForms: newPersistedForms };
        });
      },

      clearAll: () => {
        set({ persistedForms: {} });
      },
    }),
    {
      name: 'zodula-create-form-persistence', // localStorage key
    }
  )
);

