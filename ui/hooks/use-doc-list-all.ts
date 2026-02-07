import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { zodula } from "@/zodula/client";
import { create } from "zustand";

interface DocListAllCache {
    [doctype: string]: {
        docs: any[];
        lastFetched: number;
        isLoaded: boolean;
    };
}

interface DocListAllStore {
    cache: DocListAllCache;
    reloadTriggers: Record<string, number>; // Track reload triggers by doctype
    setDocs: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        docs: Zodula.SelectDoctype<DT>[]
    ) => void;
    getDocs: <DT extends Zodula.DoctypeName>(
        doctype: DT
    ) => Zodula.SelectDoctype<DT>[] | null;
    invalidate: (doctype: string) => void;
    triggerReload: (doctype: string) => void; // Trigger a reload for a doctype
    clearCache: () => void;
    isLoaded: (doctype: string) => boolean;
}

// Store for caching all records per doctype - session-only (cleared on page reload)
export const useDocListAllStore = create<DocListAllStore>()((set, get) => ({
    cache: {},
    reloadTriggers: {},
    setDocs: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        docs: Zodula.SelectDoctype<DT>[]
    ) => {
        const { cache } = get();
        set({
            cache: {
                ...cache,
                [doctype]: {
                    docs,
                    lastFetched: Date.now(),
                    isLoaded: true,
                },
            },
        });
    },
    getDocs: <DT extends Zodula.DoctypeName>(
        doctype: DT
    ) => {
        const { cache } = get();
        return cache[doctype]?.docs || null;
    },
    invalidate: (doctype: string) => {
        const { cache } = get();
        if (cache[doctype]) {
            const newCache = { ...cache };
            delete newCache[doctype];
            set({ cache: newCache });
        }
    },
    triggerReload: (doctype: string) => {
        const { reloadTriggers } = get();
        // Clear pending fetches for this doctype
        pendingFetches.delete(doctype);
        // Invalidate cache
        get().invalidate(doctype);
        // Increment trigger counter to force hooks to refetch
        set({
            reloadTriggers: {
                ...reloadTriggers,
                [doctype]: (reloadTriggers[doctype] || 0) + 1,
            },
        });
    },
    clearCache: () => {
        set({ cache: {}, reloadTriggers: {} });
    },
    isLoaded: (doctype: string) => {
        const { cache } = get();
        return cache[doctype]?.isLoaded || false;
    },
}));

// Track pending fetches per doctype to prevent overlapping requests
const pendingFetches = new Map<string, Promise<any>>();

interface useDocListAllOptions<DT extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DT;
    // Optional: force refetch even if cached
    forceRefetch?: boolean;
    // Optional: cache TTL in milliseconds (default: no expiration)
    cacheTTL?: number;
}

interface useDocListAllResult<TDoc extends Record<string, any> = Record<string, any>> {
    docs: TDoc[];
    loading: boolean;
    error: string | null;
    reload: () => void;
    invalidate: () => void;
}

/**
 * Hook to fetch all records for a doctype with persistent caching
 * 
 * Features:
 * - Fetches all records without filters, limits, or sorting
 * - Caches results in memory (session-only, cleared on page reload)
 * - Only fetches once per session unless explicitly invalidated
 * - Prevents duplicate concurrent requests
 * 
 * @param options - Configuration for the doc list query
 * @returns Doc list result with cached data
 */
export function useDocListAll<DT extends Zodula.DoctypeName = Zodula.DoctypeName, TDoc extends Zodula.SelectDoctype<DT> = Zodula.SelectDoctype<DT>>(
    options: useDocListAllOptions<DT>
): useDocListAllResult<TDoc> {
    const { doctype, forceRefetch = false, cacheTTL } = options;
    
    const { cache, reloadTriggers, setDocs, getDocs, invalidate: invalidateStore, isLoaded: isLoadedStore } = useDocListAllStore();

    // Get cached docs
    const cachedDocs = useMemo(() => {
        if (!doctype) return null;
        
        const cached = getDocs(doctype);
        if (!cached) return null;

        // Check cache TTL if provided
        if (cacheTTL) {
            const cacheEntry = cache[doctype];
            if (cacheEntry && Date.now() - cacheEntry.lastFetched > cacheTTL) {
                return null; // Cache expired
            }
        }

        return cached as TDoc[];
    }, [doctype, cache, getDocs, cacheTTL]);

    const [docs, setDocsState] = useState<TDoc[]>(cachedDocs || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const initializedRef = useRef<string | null>(null);
    const lastReloadTriggerRef = useRef<Record<string, number>>({});

    const fetchAll = useCallback(async () => {
        if (!doctype) {
            setDocsState([]);
            setLoading(false);
            setError(null);
            return;
        }

        // Check if there's already a pending fetch for this doctype
        const pendingFetch = pendingFetches.get(doctype);
        if (pendingFetch) {
            // Wait for the existing fetch to complete
            try {
                const result = await pendingFetch;
                setDocsState(result);
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
                // Fetch all records without any filters, limits, or sorting
                const response = await zodula?.doc?.select_docs(doctype, {
                    limit: -1, // No limit - fetch all
                    filters: [],
                    sort: "idx",
                    order: "asc",
                });

                const fetchedDocs = (response.docs || []) as TDoc[];
                
                // Cache the results
                setDocs(doctype, fetchedDocs);
                
                return fetchedDocs;
            } catch (e: any) {
                throw e;
            }
        })();

        pendingFetches.set(doctype, fetchPromise);

        try {
            const result = await fetchPromise;
            setDocsState(result);
            setLoading(false);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Failed to load docs");
            setLoading(false);
        } finally {
            pendingFetches.delete(doctype);
        }
    }, [doctype, setDocs]);

    // Fetch on mount if not cached or if forcing refetch
    useEffect(() => {
        // Reset initialization when doctype changes
        if (initializedRef.current !== doctype) {
            initializedRef.current = null;
        }

        // Check if a reload was triggered for this doctype
        const reloadTrigger = reloadTriggers[doctype] || 0;
        const lastReloadTrigger = lastReloadTriggerRef.current[doctype] || 0;
        
        // If a reload was triggered, reset initialization to force refetch
        if (reloadTrigger > lastReloadTrigger) {
            initializedRef.current = null;
            lastReloadTriggerRef.current[doctype] = reloadTrigger;
            // Clear pending fetches to ensure fresh data
            pendingFetches.delete(doctype);
        }

        // If we have cached data and not forcing refetch, use it
        if (cachedDocs && !forceRefetch && initializedRef.current !== doctype) {
            setDocsState(cachedDocs);
            setLoading(false);
            initializedRef.current = doctype;
            return;
        }

        // If cache was invalidated (cachedDocs is null but we were initialized), force refetch
        if (initializedRef.current === doctype && !cachedDocs && !forceRefetch) {
            // Cache was invalidated, reset initialization and refetch
            initializedRef.current = null;
        }

        // If already initialized for this doctype and not forcing refetch, skip
        if (initializedRef.current === doctype && !forceRefetch && cachedDocs) {
            return;
        }

        // Fetch data
        fetchAll();
        initializedRef.current = doctype;
    }, [doctype, forceRefetch, cachedDocs, fetchAll, reloadTriggers]);

    const reload = useCallback(async () => {
        if (!doctype) return;

        // Clear any pending fetches
        pendingFetches.delete(doctype);

        // Force refetch
        await fetchAll();
    }, [doctype, fetchAll]);

    const invalidate = useCallback(() => {
        if (!doctype) return;
        invalidateStore(doctype);
        setDocsState([]);
    }, [doctype, invalidateStore]);

    return {
        docs: docs || [],
        loading,
        error,
        reload,
        invalidate,
    };
}

