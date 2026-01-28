import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';

interface ColumnSettingsState {
  // Visible columns per doctype
  visibleColumns: Record<string, string[]>;
  
  // Has custom columns flag per doctype
  hasCustomColumns: Record<string, boolean>;
  
  // Actions (per doctype)
  setVisibleColumns: (doctype: string, columns: string[]) => void;
  setHasCustomColumns: (doctype: string, hasCustom: boolean) => void;
  resetVisibleColumns: (doctype: string) => void;
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
    }),
    {
      name: 'zodula-column-settings-storage',
      // use default storage (localStorage in browser)
    } as any
  )
);

// Hook for easier access with validation
export const useColumnSettings = (
  doctype: string,
  defaultColumns: string[],
  allAvailableColumns: Array<{ key: string | number }>
) => {
  // Read full store; avoid selectors that return new objects (can confuse React dev mode)
  const store = useColumnSettingsStore();

  const storedVisibleColumns = store.visibleColumns[doctype] || null;
  const storedHasCustomColumns = store.hasCustomColumns[doctype] || false;
  const setVisibleColumnsForDoctype = store.setVisibleColumns;
  const setHasCustomColumnsForDoctype = store.setHasCustomColumns;
  const resetVisibleColumnsForDoctype = store.resetVisibleColumns;

  // Get available column keys
  const availableColumnKeys = useMemo(
    () => allAvailableColumns.map(col => String(col.key)),
    [allAvailableColumns]
  );

  // Get and validate visible columns
  const visibleColumns = useMemo(() => {
    // If nothing stored yet, or storage not hydrated, fall back to defaults
    if (!storedVisibleColumns || storedVisibleColumns.length === 0) {
      return defaultColumns;
    }

    // Validate stored columns against available columns
    const validColumns = storedVisibleColumns.filter((colKey: string) =>
      availableColumnKeys.includes(String(colKey))
    );

    // If all stored columns are valid, use them; otherwise use defaults
    return validColumns.length > 0 ? validColumns : defaultColumns;
  }, [storedVisibleColumns, defaultColumns, availableColumnKeys]);

  return {
    visibleColumns,
    hasCustomColumns: storedHasCustomColumns,
    setVisibleColumns: (columns: string[]) => {
      // Validate before setting
      const validColumns = columns.filter((colKey: string) =>
        availableColumnKeys.includes(String(colKey))
      );
      setVisibleColumnsForDoctype(
        doctype,
        validColumns.length > 0 ? validColumns : defaultColumns
      );
      setHasCustomColumnsForDoctype(doctype, true);
    },
    setHasCustomColumns: (hasCustom: boolean) =>
      setHasCustomColumnsForDoctype(doctype, hasCustom),
    resetVisibleColumns: () => {
      resetVisibleColumnsForDoctype(doctype);
      setVisibleColumnsForDoctype(doctype, defaultColumns);
      setHasCustomColumnsForDoctype(doctype, false);
    },
  };
};

