import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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

// Cache for system-generated doctypes
interface DocListCacheItem {
    docs: any[];
    count: number;
    lastFetched: number;
    loading: boolean;
    error: string | null;
}

interface DocListCache {
    [doctype: string]: {
        [cacheKey: string]: DocListCacheItem;
    };
}

// Global cache store
let docListCache: DocListCache = {};

// System-generated doctypes that should be cached
const SYSTEM_GENERATED_DOCTYPES = [
    'zodula__Field',
    'zodula__Doctype', 
    'zodula__App',
    'zodula__Role',
    'zodula__User',
    'zodula__Workspace',
    'zodula__Workspace Item',
    'zodula__Doctype Permission',
    'zodula__User Permission',
    'zodula__User Role',
    'zodula__Session',
    'zodula__Page',
    'zodula__Global Setting',
    'zodula__Doctype Relative',
    'zodula__Language',
    'zodula__Translation'
];

// Cache TTL for system-generated doctypes (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Generate cache key from options
function generateCacheKey(options: useDocListOptions<any>): string {
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

// Check if doctype is system-generated
function isSystemGenerated(doctype: string): boolean {
    return SYSTEM_GENERATED_DOCTYPES.includes(doctype);
}

// Get cached data
function getCachedData(doctype: string, cacheKey: string): DocListCacheItem | null {
    const cache = docListCache[doctype]?.[cacheKey];
    if (!cache) return null;
    
    // Check if cache is expired
    if (Date.now() - cache.lastFetched > CACHE_TTL) {
        return null;
    }
    
    return cache;
}

// Set cached data
function setCachedData(doctype: string, cacheKey: string, data: DocListCacheItem): void {
    if (!docListCache[doctype]) {
        docListCache[doctype] = {};
    }
    docListCache[doctype][cacheKey] = data;
}

// Clear cache for a doctype
function clearCacheForDoctype(doctype: string): void {
    if (docListCache[doctype]) {
        delete docListCache[doctype];
    }
}

// Clear all cache
function clearAllCache(): void {
    docListCache = {};
}

/**
 * Enhanced useDocList hook with caching and debouncing
 * 
 * Features:
 * - Automatic caching for system-generated doctypes (Field, Doctype, App, etc.)
 * - 300ms debouncing to prevent excessive API calls
 * - 5-minute cache TTL for system doctypes
 * - Cache invalidation utilities via docListCacheManager
 * 
 * @param options - Configuration for the doc list query
 * @param deps - Dependencies array for re-fetching
 * @returns Enhanced doc list result with caching
 */
export function useDocList<DT extends Zodula.DoctypeName = Zodula.DoctypeName, TDoc extends Zodula.SelectDoctype<DT> = Zodula.SelectDoctype<DT>>(
    options: useDocListOptions<DT>,
    deps: any[] = []
): useDocListResult<TDoc> {
    const [docs, setDocs] = useState<TDoc[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Use external params directly instead of internal state
    const limit = options.limit || 20;
    const sort = options.sort || "updated_at";
    const order = options.order || "desc";
    const q = options.q || "";
    const filters = options.filters || [];

    // Generate cache key
    const cacheKey = useMemo(() => generateCacheKey(options), [options]);
    const shouldCache = useMemo(() => isSystemGenerated(options.doctype), [options.doctype]);

    const fetchList = useCallback(async (useCache: boolean = true) => {
        if (!options.doctype) return;

        // Check cache first for system-generated doctypes
        if (shouldCache && useCache) {
            const cached = getCachedData(options.doctype, cacheKey);
            if (cached && !cached.loading) {
                setDocs(cached.docs as TDoc[]);
                setCount(cached.count);
                setLoading(false);
                setError(cached.error);
                return;
            }
        }

        setLoading(true);
        setError(null);

        // Update cache with loading state
        if (shouldCache) {
            setCachedData(options.doctype, cacheKey, {
                docs: docs,
                count: count,
                lastFetched: Date.now(),
                loading: true,
                error: null
            });
        }

        try {
            const response = await zodula?.doc?.select_docs(options.doctype, {
                limit: limit,
                sort,
                order,
                filters: filters,
                q
            });

            const newDocs = response.docs as TDoc[];
            const newCount = response.count;

            setDocs(newDocs);
            setCount(newCount);

            // Update cache with fresh data
            if (shouldCache) {
                setCachedData(options.doctype, cacheKey, {
                    docs: newDocs,
                    count: newCount,
                    lastFetched: Date.now(),
                    loading: false,
                    error: null
                });
            }
        } catch (e: any) {
            const errorMessage = e?.message || "Failed to load docs";
            setError(errorMessage);

            // Update cache with error state
            if (shouldCache) {
                setCachedData(options.doctype, cacheKey, {
                    docs: docs,
                    count: count,
                    lastFetched: Date.now(),
                    loading: false,
                    error: errorMessage
                });
            }
        } finally {
            setLoading(false);
        }
    }, [options, cacheKey, shouldCache, docs, count]);

    // Debounced fetch function
    const debouncedFetchList = useCallback((useCache: boolean = true) => {
        // Clear existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Set new timeout for debouncing
        debounceTimeoutRef.current = setTimeout(() => {
            fetchList(useCache);
        }, 300); // 300ms debounce
    }, [fetchList]);

    useEffect(() => {
        // Check cache first for system-generated doctypes
        if (shouldCache) {
            const cached = getCachedData(options.doctype, cacheKey);
            if (cached && !cached.loading) {
                setDocs(cached.docs as TDoc[]);
                setCount(cached.count);
                setLoading(false);
                setError(cached.error);
                return;
            }
        }

        // Use debounced fetch for all requests
        debouncedFetchList(true);
    }, [options.doctype, cacheKey, shouldCache, ...deps]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    const reload = useCallback(() => {
        // Force reload without cache
        fetchList(false);
    }, [fetchList]);

    return {
        docs: docs || [],
        count,
        limit,
        loading,
        error,
        reload,
    };
}

/**
 * Cache management utilities for useDocList hook
 * 
 * Use these functions to manage the cache when system doctypes are updated:
 * - clearCacheForDoctype: Clear cache for a specific doctype
 * - clearAllCache: Clear all cached data
 * - getCachedData: Get cached data for inspection
 * - isSystemGenerated: Check if a doctype is system-generated
 */
export const docListCacheManager = {
    clearCacheForDoctype,
    clearAllCache,
    getCachedData: (doctype: string, cacheKey: string) => getCachedData(doctype, cacheKey),
    isSystemGenerated
};


