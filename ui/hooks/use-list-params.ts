import { useMemo, useCallback, useState } from "react";
import { useRouter } from "../components/router";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";

export interface ListParams {
  limit: number | null;
  sort: string | null;
  order: "asc" | "desc" | null;
  q: string | null;
  filters: IFilter<any, any, IOperator>[] | null;
}

export interface ListParamsActions {
  updateSearchParams: (updates: Partial<ListParams>) => void;
  onLimitChange: (newLimit: number | null) => void;
  onSort: (field: string) => void;
  onSortChange: (field: string) => void;
  onOrderChange: (newOrder: "asc" | "desc" | null) => void;
  onSearch: (query: string | null) => void;
  onApplyFilters: (newFilters: IFilter<any, any, IOperator>[] | null) => void;
  onClearFilter: () => void;
  selected: Set<string>;
  setSelected: (selected: Set<string>) => void;
}

export function useListParams(): ListParams & ListParamsActions {
  const { search, push, location } = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Parse current URL parameters
  const params: ListParams = useMemo(() => {
    const limit = parseInt(search.limit || "20");
    const sort = search.sort || "updated_at";
    const order = (search.order as "asc" | "desc") || "desc";
    const q = search.q || "";

    // Parse filters from URL search params
    let filters: IFilter<any, any, IOperator>[] = [];
    try {
      const filtersParam = decodeURIComponent(search.filters || "");
      if (filtersParam) {
        filters = JSON.parse(filtersParam) as IFilter<any, any, IOperator>[];
      }
    } catch (e) {
      console.warn("Failed to parse filters from URL:", e);
    }

    return {
      limit,
      sort,
      order,
      q,
      filters,
    };
  }, [search]);

  // Update URL search params
  const updateSearchParams = useCallback(
    (updates: Partial<ListParams>) => {
      const newSearch = { ...search, ...updates };
      // Handle filters specially - encode as JSON
      if (updates.filters) {
        newSearch.filters = encodeURIComponent(
          JSON.stringify(updates.filters)
        ) as any;
      }

      const searchString = new URLSearchParams(
        Object.entries(newSearch)
          .filter(([_, v]) => v !== null && v !== "")
          .map(([k, v]) => [k, String(v)])
      ).toString();
      push(`${window.location.pathname}?${searchString}`, { replace: true });
    },
    [search, push, location]
  );

  const handleLimitChange = useCallback(
    (newLimit: number | null) => {
      if (newLimit == 20) {
        updateSearchParams({ limit: null });
        return;
      }
      updateSearchParams({ limit: newLimit });
    },
    [search]
  );

  const handleSort = useCallback(
    (field: string) => {
      let newSort: string | null;
      let newOrder: "asc" | "desc" | null;

      if (params.sort !== field) {
        // Step 1: not sorted, go to asc
        newSort = field;
        newOrder = "asc";
      } else if (params.order === "asc") {
        // Step 2: asc, go to desc
        newSort = field;
        newOrder = "desc";
      } else if (params.order === "desc") {
        // Step 3: desc, go to null (unsorted)
        newSort = null;
        newOrder = null;
      } else {
        // fallback, go to asc
        newSort = field;
        newOrder = "asc";
      }

      updateSearchParams({
        sort: newSort,
        order: newOrder,
      });
    },
    [params.sort, params.order, search]
  );

  const handleSortChange = useCallback(
    (field: string | null) => {
      updateSearchParams({ sort: field });
    },
    [search]
  );

  const handleOrderChange = useCallback(
    (newOrder: "asc" | "desc" | null) => {
      updateSearchParams({ order: newOrder });
    },
    [search]
  );

  const handleSearch = useCallback(
    (query: string | null) => {
      updateSearchParams({ q: query });
    },
    [search]
  );

  const handleApplyFilters = useCallback(
    (newFilters: IFilter<any, any, IOperator>[] | null) => {
      updateSearchParams({ filters: newFilters });
    },
    [search]
  );

  const handleClearFilter = useCallback(() => {
    updateSearchParams({ q: null, filters: null });
  }, [search]);

  return {
    ...params,
    updateSearchParams,
    onLimitChange: handleLimitChange,
    onSort: handleSort,
    onSortChange: handleSortChange,
    onOrderChange: handleOrderChange,
    onSearch: handleSearch,
    onApplyFilters: handleApplyFilters,
    onClearFilter: handleClearFilter,
    selected,
    setSelected,
  };
}
