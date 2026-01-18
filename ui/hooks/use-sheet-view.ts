import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AggregateFunction = 'Count' | 'Sum' | 'Average';

export interface ColumnConfig {
  key: string;
  width: number;
  order: number;
}

export interface AggregationConfig {
  groupBy: string | null;
  aggregateFunction: AggregateFunction;
  aggregateField: string | null;
}

interface SheetViewState {
  // Column configurations per doctype
  columnConfigs: Record<string, Record<string, ColumnConfig>>;
  
  // Aggregation configs per doctype
  aggregationConfigs: Record<string, AggregationConfig>;
  
  // Visible columns per doctype (for column settings)
  visibleColumns: Record<string, string[]>;
  
  // Actions
  setColumnConfig: (doctype: string, columnKey: string, config: Partial<ColumnConfig>) => void;
  setColumnWidth: (doctype: string, columnKey: string, width: number) => void;
  setColumnOrder: (doctype: string, columnKeys: string[]) => void;
  setAggregationConfig: (doctype: string, config: AggregationConfig) => void;
  setVisibleColumns: (doctype: string, columns: string[]) => void;
  resetColumnConfigs: (doctype: string) => void;
  resetAggregationConfig: (doctype: string) => void;
  
  // Getters
  getColumnConfig: (doctype: string, columnKey: string) => ColumnConfig | null;
  getColumnWidth: (doctype: string, columnKey: string, defaultWidth?: number) => number;
  getAggregationConfig: (doctype: string) => AggregationConfig;
  getVisibleColumns: (doctype: string) => string[] | null;
}

const defaultAggregationConfig: AggregationConfig = {
  groupBy: null,
  aggregateFunction: 'Count',
  aggregateField: null,
};

export const useSheetViewStore = create<SheetViewState>()(
  persist(
    (set, get) => ({
      columnConfigs: {},
      aggregationConfigs: {},
      visibleColumns: {},

      setColumnConfig: (doctype: string, columnKey: string, config: Partial<ColumnConfig>) => {
        set((state) => {
          const doctypeConfigs = state.columnConfigs[doctype] || {};
          const existing = doctypeConfigs[columnKey] || {
            key: columnKey,
            width: 240,
            order: 0,
          };

          return {
            columnConfigs: {
              ...state.columnConfigs,
              [doctype]: {
                ...doctypeConfigs,
                [columnKey]: {
                  ...existing,
                  ...config,
                  key: columnKey,
                },
              },
            },
          };
        });
      },

      setColumnWidth: (doctype: string, columnKey: string, width: number) => {
        get().setColumnConfig(doctype, columnKey, { width });
      },

      setColumnOrder: (doctype: string, columnKeys: string[]) => {
        set((state) => {
          const doctypeConfigs = state.columnConfigs[doctype] || {};
          const newConfigs: Record<string, ColumnConfig> = {};

          columnKeys.forEach((key, index) => {
            const existing = doctypeConfigs[key] || {
              key,
              width: 240,
              order: index,
            };
            newConfigs[key] = {
              ...existing,
              key,
              order: index,
            };
          });

          return {
            columnConfigs: {
              ...state.columnConfigs,
              [doctype]: newConfigs,
            },
          };
        });
      },

      setAggregationConfig: (doctype: string, config: AggregationConfig) => {
        set((state) => ({
          aggregationConfigs: {
            ...state.aggregationConfigs,
            [doctype]: config,
          },
        }));
      },

      resetColumnConfigs: (doctype: string) => {
        set((state) => {
          const newConfigs = { ...state.columnConfigs };
          delete newConfigs[doctype];
          return { columnConfigs: newConfigs };
        });
      },

      resetAggregationConfig: (doctype: string) => {
        set((state) => {
          const newConfigs = { ...state.aggregationConfigs };
          delete newConfigs[doctype];
          return { aggregationConfigs: newConfigs };
        });
      },

      getColumnConfig: (doctype: string, columnKey: string) => {
        const state = get();
        return state.columnConfigs[doctype]?.[columnKey] || null;
      },

      getColumnWidth: (doctype: string, columnKey: string, defaultWidth = 180) => {
        const config = get().getColumnConfig(doctype, columnKey);
        return config?.width || defaultWidth;
      },

      getAggregationConfig: (doctype: string) => {
        const state = get();
        return state.aggregationConfigs[doctype] || defaultAggregationConfig;
      },

      setVisibleColumns: (doctype: string, columns: string[]) => {
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [doctype]: columns,
          },
        }));
      },

      getVisibleColumns: (doctype: string) => {
        const state = get();
        return state.visibleColumns[doctype] || null;
      },
    }),
    {
      name: 'zodula-sheet-view-storage',
    }
  )
);

// Hook for easier access
export const useSheetView = (doctype: string) => {
  const store = useSheetViewStore();
  
  return {
    getColumnWidth: (columnKey: string, defaultWidth = 240) =>
      store.getColumnWidth(doctype, columnKey, defaultWidth),
    setColumnWidth: (columnKey: string, width: number) =>
      store.setColumnWidth(doctype, columnKey, width),
    setColumnOrder: (columnKeys: string[]) =>
      store.setColumnOrder(doctype, columnKeys),
    getColumnConfig: (columnKey: string) =>
      store.getColumnConfig(doctype, columnKey),
    setColumnConfig: (columnKey: string, config: Partial<ColumnConfig>) =>
      store.setColumnConfig(doctype, columnKey, config),
    aggregationConfig: store.getAggregationConfig(doctype),
    setAggregationConfig: (config: AggregationConfig) =>
      store.setAggregationConfig(doctype, config),
    visibleColumns: store.getVisibleColumns(doctype),
    setVisibleColumns: (columns: string[]) =>
      store.setVisibleColumns(doctype, columns),
    resetColumnConfigs: () => store.resetColumnConfigs(doctype),
    resetAggregationConfig: () => store.resetAggregationConfig(doctype),
  };
};

