import { useCallback, useEffect, useState, useMemo } from "react";
import { zodula } from "@/zodula/client";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";

interface useDocListOptions<DT extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DT;
    limit?: number | null;
    sort?: string | null;
    order?: "asc" | "desc" | null;
    q?: string | null;
    filters?: IFilter<DT, keyof Zodula.InsertDoctype<DT>, IOperator>[] | null;
}

interface useDocListResult<TDoc extends Record<string, any> = Record<string, any>> {
    docs: TDoc[];
    count: number;
    limit: number;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

// Track pending fetches per cache key to prevent overlapping requests
const pendingFetches = new Map<string, Promise<any>>();

// Generate a unique key for the request based on options
function generateRequestKey(options: useDocListOptions<any>): string {
    const { doctype, limit, sort, order, q, filters } = options;
    return JSON.stringify({
        doctype,
        limit: limit || 20,
        sort: sort || "updated_at",
        order: order || "desc",
        q: q || "",
        filters: filters || []
    });
}

/**
 * Simplified useDocList hook
 * 
 * Features:
 * - Prevents duplicate concurrent requests
 * - Simple state management without caching
 * 
 * @param options - Configuration for the doc list query
 * @param deps - Dependencies array for re-fetching
 * @returns Doc list result
 */
export function useDocList<DT extends Zodula.DoctypeName = Zodula.DoctypeName, TDoc extends Zodula.SelectDoctype<DT> = Zodula.SelectDoctype<DT>>(
    options: useDocListOptions<DT>,
    deps: any[] = []
): useDocListResult<TDoc> {
    const [docs, setDocs] = useState<TDoc[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use external params directly
    const limit = options.limit || 20;
    const sort = options.sort || "updated_at";
    const order = options.order || "desc";
    const q = options.q || "";
    const filters = options.filters || [];

    // Generate request key for tracking pending fetches
    const requestKey = useMemo(() => generateRequestKey(options), [options]);

    const fetchList = useCallback(async () => {
        if (!options.doctype) {
            setDocs([]);
            setCount(0);
                setLoading(false);
            setError(null);
                return;
            }

        // Check if there's already a pending fetch for this request
        const pendingFetch = pendingFetches.get(requestKey);
            if (pendingFetch) {
                // Wait for the existing fetch to complete
            try {
                const result = await pendingFetch;
                setDocs(result.docs);
                setCount(result.count);
                    setLoading(false);
                setError(null);
                    } catch (e: any) {
                setError(e?.message || "Failed to load docs");
                        setLoading(false);
            }
            return;
        }

        // Start a new fetch
        setLoading(true);
        setError(null);

        const fetchPromise = (async () => {
        try {
            const response = await zodula?.doc?.select_docs(options.doctype, {
                limit: limit,
                sort,
                order,
                filters: filters,
                q
            });

                return {
                    docs: response.docs as TDoc[],
                    count: response.count
                };
            } catch (e: any) {
                throw e;
            }
        })();

        pendingFetches.set(requestKey, fetchPromise);

        try {
            const result = await fetchPromise;
            setDocs(result.docs);
            setCount(result.count);
            setLoading(false);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Failed to load docs");
            setLoading(false);
        } finally {
            pendingFetches.delete(requestKey);
        }
    }, [options.doctype, requestKey, limit, sort, order, filters, q]);

    // Fetch when dependencies change
    useEffect(() => {
        fetchList();
    }, [...deps]);

    const reload = useCallback(async () => {
        if (!options.doctype) return;

        // Clear any pending fetches for this request
        pendingFetches.delete(requestKey);

        // Fetch immediately
        await fetchList();
    }, [options.doctype, requestKey]);

    return {
        docs: docs || [],
        count,
        limit,
        loading,
        error,
        reload,
    };
}
