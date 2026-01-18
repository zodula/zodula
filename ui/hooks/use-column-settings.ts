import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo, useEffect } from 'react';

interface ColumnSettingsState {
  // Visible columns per doctype
  visibleColumns: Record<string, string[]>;
  
  // Has custom columns flag per doctype
  hasCustomColumns: Record<string, boolean>;
  
  // Actions
  setVisibleColumns: (doctype: string, columns: string[]) => void;
  setHasCustomColumns: (doctype: string, hasCustom: boolean) => void;
  resetVisibleColumns: (doctype: string) => void;
  
  // Getters
  getVisibleColumns: (doctype: string) => string[] | null;
  getHasCustomColumns: (doctype: string) => boolean;
}

export const useColumnSettingsStore = create<ColumnSettingsState>()(
  persist(
    (set, get) => ({
      visibleColumns: {},
      hasCustomColumns: {},

      setVisibleColumns: (doctype: string, columns: string[]) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [doctype]: columns,
          },
        })),

      setHasCustomColumns: (doctype: string, hasCustom: boolean) =>
        set((state) => ({
          hasCustomColumns: {
            ...state.hasCustomColumns,
            [doctype]: hasCustom,
          },
        })),

      resetVisibleColumns: (doctype: string) =>
        set((state) => {
          const newVisibleColumns = { ...state.visibleColumns };
          const newHasCustomColumns = { ...state.hasCustomColumns };
          delete newVisibleColumns[doctype];
          delete newHasCustomColumns[doctype];
          return { 
            visibleColumns: newVisibleColumns,
            hasCustomColumns: newHasCustomColumns,
          };
        }),

      getVisibleColumns: (doctype: string) => get().visibleColumns[doctype] || null,

      getHasCustomColumns: (doctype: string) => get().hasCustomColumns[doctype] || false,
    }),
    {
      name: 'zodula-column-settings-storage',
      getStorage: () => localStorage,
    }
  )
);

// Hook for easier access with validation
export const useColumnSettings = (
  doctype: string,
  defaultColumns: string[],
  allAvailableColumns: Array<{ key: string | number }>
) => {
  const store = useColumnSettingsStore();

  // Get available column keys
  const availableColumnKeys = useMemo(
    () => allAvailableColumns.map(col => String(col.key)),
    [allAvailableColumns]
  );

  // Get and validate visible columns
  const visibleColumns = useMemo(() => {
    const stored = store.getVisibleColumns(doctype);
    if (!stored || stored.length === 0) {
      return defaultColumns;
    }

    // Validate stored columns against available columns
    const validColumns = stored.filter((colKey: string) =>
      availableColumnKeys.includes(String(colKey))
    );

    // If all stored columns are valid, use them; otherwise use defaults
    return validColumns.length > 0 ? validColumns : defaultColumns;
  }, [store, doctype, defaultColumns, availableColumnKeys]);

  // Initialize visible columns if not set
  useEffect(() => {
    if (defaultColumns.length === 0 || availableColumnKeys.length === 0) return;
    
    const stored = store.getVisibleColumns(doctype);
    if (!stored || stored.length === 0) {
      store.setVisibleColumns(doctype, defaultColumns);
      store.setHasCustomColumns(doctype, false);
    } else {
      // Validate and update if needed
      const validColumns = stored.filter((colKey: string) =>
        availableColumnKeys.includes(String(colKey))
      );
      
      if (validColumns.length !== stored.length) {
        // Some columns are invalid, update with valid ones
        if (validColumns.length > 0) {
          store.setVisibleColumns(doctype, validColumns);
        } else {
          store.setVisibleColumns(doctype, defaultColumns);
          store.setHasCustomColumns(doctype, false);
        }
      }
    }
  }, [doctype, defaultColumns, availableColumnKeys, store]);

  return {
    visibleColumns,
    hasCustomColumns: store.getHasCustomColumns(doctype),
    setVisibleColumns: (columns: string[]) => {
      // Validate before setting
      const validColumns = columns.filter((colKey: string) =>
        availableColumnKeys.includes(String(colKey))
      );
      store.setVisibleColumns(doctype, validColumns.length > 0 ? validColumns : defaultColumns);
      store.setHasCustomColumns(doctype, true);
    },
    setHasCustomColumns: (hasCustom: boolean) => store.setHasCustomColumns(doctype, hasCustom),
    resetVisibleColumns: () => {
      store.setVisibleColumns(doctype, defaultColumns);
      store.setHasCustomColumns(doctype, false);
    },
  };
};

