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

// Cache for fully-loaded doctypes (stores all records, keyed by doctype only)
interface FullyLoadedCache {
    [doctype: string]: {
        allDocs: any[];
        lastFetched: number;
        loading: boolean;
        error: string | null;
    };
}

// Global cache store
let docListCache: DocListCache = {};
let fullyLoadedCache: FullyLoadedCache = {};

// Track pending fetches per doctype to prevent overlapping triggers for fully-loaded doctypes
const pendingFullyLoadedFetches = new Map<string, Promise<void>>();

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

// Doctypes that should load ALL records and use client-side filtering/sorting
const FULLY_LOADED_DOCTYPES = [
    'zodula__Global Setting',
    'zodula__Translation',
    'zodula__Language'
];

// Check if doctype should load all records and filter locally
function shouldLoadAllRecords(doctype: string): boolean {
    return FULLY_LOADED_DOCTYPES.includes(doctype);
}

// Cache TTL for system-generated doctypes (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Generate cache key from options
// For fully-loaded doctypes, only use doctype (no query params)
// For others, include all query params
function generateCacheKey(options: useDocListOptions<any>): string {
    if (shouldLoadAllRecords(options.doctype)) {
        return options.doctype; // Only doctype for fully-loaded doctypes
    }
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

// Get fully-loaded cache
// For fully-loaded doctypes, cache never expires (until explicit reload)
function getFullyLoadedCache(doctype: string) {
    const cache = fullyLoadedCache[doctype];
    if (!cache) return null;
    
    // Don't check CACHE_TTL for fully-loaded doctypes - they stay cached indefinitely
    // Only check if data exists and is not loading
    return cache;
}

// Set fully-loaded cache
function setFullyLoadedCache(doctype: string, data: { allDocs: any[]; lastFetched: number; loading: boolean; error: string | null }): void {
    fullyLoadedCache[doctype] = data;
}

// Clear fully-loaded cache for a doctype
function clearFullyLoadedCache(doctype: string): void {
    if (fullyLoadedCache[doctype]) {
        delete fullyLoadedCache[doctype];
    }
}

// Client-side filtering and sorting
function applyLocalFilters<TDoc extends Record<string, any>>(
    allDocs: TDoc[],
    options: useDocListOptions<any>
): { docs: TDoc[]; count: number } {
    let filteredDocs = [...allDocs];
    
    // Apply filters
    if (options.filters && options.filters.length > 0) {
        filteredDocs = filteredDocs.filter((doc) => {
            return options.filters!.every((filter) => {
                const [field, operator, value] = filter;
                const docValue = doc[field as string];
                
                switch (operator) {
                    case "=":
                        return docValue === value;
                    case "!=":
                        return docValue !== value;
                    case ">":
                        return docValue > value;
                    case ">=":
                        return docValue >= value;
                    case "<":
                        return docValue < value;
                    case "<=":
                        return docValue <= value;
                    case "LIKE":
                        return String(docValue).toLowerCase().includes(String(value).toLowerCase());
                    case "NOT LIKE":
                        return !String(docValue).toLowerCase().includes(String(value).toLowerCase());
                    case "IN":
                        return Array.isArray(value) && value.includes(docValue);
                    case "NOT IN":
                        return Array.isArray(value) && !value.includes(docValue);
                    case "IS NULL":
                        return docValue === null || docValue === undefined;
                    case "IS NOT NULL":
                        return docValue !== null && docValue !== undefined;
                    default:
                        return true;
                }
            });
        });
    }
    
    // Apply search query (q)
    if (options.q) {
        const query = options.q.toLowerCase();
        filteredDocs = filteredDocs.filter((doc) => {
            // Search across all string fields
            return Object.values(doc).some((val) => {
                if (typeof val === "string") {
                    return val.toLowerCase().includes(query);
                }
                if (typeof val === "number") {
                    return String(val).includes(query);
                }
                return false;
            });
        });
    }
    
    // Apply sorting
    const sortField = options.sort || "updated_at";
    const order = options.order || "desc";
    
    if (sortField) {
        filteredDocs.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            
            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return order === "asc" ? comparison : -comparison;
        });
    }
    
    const totalCount = filteredDocs.length;
    
    // Apply limit
    const limit = options.limit || 20;
    const limitedDocs = filteredDocs.slice(0, limit);
    
    return {
        docs: limitedDocs,
        count: totalCount,
    };
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
    if (shouldLoadAllRecords(doctype)) {
        clearFullyLoadedCache(doctype);
    }
}

// Clear all cache
function clearAllCache(): void {
    docListCache = {};
    fullyLoadedCache = {};
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
    const isFullyLoaded = useMemo(() => shouldLoadAllRecords(options.doctype), [options.doctype]);

    const fetchList = useCallback(async (useCache: boolean = true) => {
        if (!options.doctype) return;

        // Handle fully-loaded doctypes differently
        if (isFullyLoaded) {
            // Check if we already have all records cached
            const cached = getFullyLoadedCache(options.doctype);
            if (cached && useCache && !cached.loading && cached.allDocs.length > 0) {
                // Apply local filtering/sorting/limiting
                const { docs: filteredDocs, count: filteredCount } = applyLocalFilters(cached.allDocs, options);
                setDocs(filteredDocs as TDoc[]);
                setCount(filteredCount);
                setLoading(false);
                setError(cached.error);
                return;
            }

            // Check if there's already a pending fetch for this doctype
            const pendingFetch = pendingFullyLoadedFetches.get(options.doctype);
            if (pendingFetch) {
                // Wait for the existing fetch to complete
                await pendingFetch;
                // After waiting, check cache again and apply filters
                const updatedCached = getFullyLoadedCache(options.doctype);
                if (updatedCached && updatedCached.allDocs.length > 0) {
                    const { docs: filteredDocs, count: filteredCount } = applyLocalFilters(updatedCached.allDocs, options);
                    setDocs(filteredDocs as TDoc[]);
                    setCount(filteredCount);
                    setLoading(false);
                    setError(updatedCached.error);
                }
                return;
            }

            // If not cached and no pending fetch, fetch all records
            // Fully-loaded doctypes don't expire - they stay cached until explicit reload
            if (!cached || cached.loading) {
                setLoading(true);
                setError(null);

                // Set loading state in cache
                setFullyLoadedCache(options.doctype, {
                    allDocs: cached?.allDocs || [],
                    lastFetched: cached?.lastFetched || 0,
                    loading: true,
                    error: null
                });

                // Create and track the fetch promise
                const fetchPromise = (async () => {
                    try {
                        // Fetch ALL records without limit, sort, order, q, or filters
                        const response = await zodula?.doc?.select_docs(options.doctype, {
                            limit: 1000000, // Very high limit to get all records
                            sort: "updated_at", // Default sort, we'll sort locally
                            order: "asc",
                            filters: undefined,
                            q: undefined
                        });

                        const allDocs = response.docs as TDoc[];

                        // Store all records in cache
                        setFullyLoadedCache(options.doctype, {
                            allDocs: allDocs,
                            lastFetched: Date.now(),
                            loading: false,
                            error: null
                        });

                        // Apply local filtering/sorting/limiting
                        const { docs: filteredDocs, count: filteredCount } = applyLocalFilters(allDocs, options);
                        
                        setDocs(filteredDocs);
                        setCount(filteredCount);
                    } catch (e: any) {
                        const errorMessage = e?.message || "Failed to load docs";
                        setError(errorMessage);

                        setFullyLoadedCache(options.doctype, {
                            allDocs: cached?.allDocs || [],
                            lastFetched: cached?.lastFetched || 0,
                            loading: false,
                            error: errorMessage
                        });
                    } finally {
                        setLoading(false);
                        // Remove from pending fetches when done
                        pendingFullyLoadedFetches.delete(options.doctype);
                    }
                })();

                pendingFullyLoadedFetches.set(options.doctype, fetchPromise);
                await fetchPromise;
            }
            return;
        }

        // Regular doctypes - use existing logic
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
    }, [options, cacheKey, shouldCache, isFullyLoaded, docs, count, limit, sort, order, filters, q]);

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

    // For fully-loaded doctypes, re-apply filters immediately when options change
    useEffect(() => {
        if (isFullyLoaded) {
            const cached = getFullyLoadedCache(options.doctype);
            if (cached && !cached.loading && cached.allDocs.length > 0) {
                // Apply local filtering/sorting/limiting immediately (no debounce needed)
                const { docs: filteredDocs, count: filteredCount } = applyLocalFilters(cached.allDocs, options);
                setDocs(filteredDocs as TDoc[]);
                setCount(filteredCount);
                setLoading(false);
                setError(cached.error);
            }
        }
    }, [isFullyLoaded, options.doctype, options.limit, options.sort, options.order, options.q, JSON.stringify(options.filters)]);

    // Initial fetch or fetch when doctype/deps change
    useEffect(() => {
        if (isFullyLoaded) {
            // For fully-loaded doctypes, check if we need to fetch
            const cached = getFullyLoadedCache(options.doctype);
            // Only fetch if we don't have cached data or if it's currently loading
            // Don't check CACHE_TTL - fully-loaded doctypes stay cached until explicit reload
            if (!cached || cached.loading) {
                // Use debounced fetch only if we need to fetch from server
                debouncedFetchList(true);
            } else {
                // We have cached data, apply filters immediately
                const { docs: filteredDocs, count: filteredCount } = applyLocalFilters(cached.allDocs, options);
                setDocs(filteredDocs as TDoc[]);
                setCount(filteredCount);
                setLoading(false);
                setError(cached.error);
            }
        } else {
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
        }
    }, [options.doctype, cacheKey, shouldCache, isFullyLoaded, ...deps]);

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
        if (isFullyLoaded) {
            // Clear the fully-loaded cache and any pending fetches to force a fresh fetch
            clearFullyLoadedCache(options.doctype);
            pendingFullyLoadedFetches.delete(options.doctype);
        }
        fetchList(false);
    }, [fetchList, isFullyLoaded, options.doctype]);

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


