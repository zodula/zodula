import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { zodula } from "@/zodula/client";
import { create } from "zustand";

interface DocAllCache {
    [doctype: string]: {
        [id: string]: {
            doc: any;
            lastFetched: number;
            isLoaded: boolean;
        };
    };
}

interface DocAllStore {
    cache: DocAllCache;
    setDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        doc: Zodula.SelectDoctype<DT> | null,
        id?: string
    ) => void;
    getDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        id?: string
    ) => Zodula.SelectDoctype<DT> | null;
    invalidate: (doctype: string, id?: string) => void;
    clearCache: () => void;
    isLoaded: (doctype: string, id?: string) => boolean;
}

// Store for caching single doctypes - session-only (cleared on page reload)
const useDocAllStore = create<DocAllStore>()((set, get) => ({
    cache: {},
    setDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        doc: Zodula.SelectDoctype<DT> | null,
        id?: string
    ) => {
        const { cache } = get();
        const docId = id || doctype;
        const newCache = { ...cache };
        if (!newCache[doctype]) {
            newCache[doctype] = {};
        }
        newCache[doctype][docId] = {
            doc,
            lastFetched: Date.now(),
            isLoaded: true,
        };
        set({ cache: newCache });
    },
    getDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        id?: string
    ) => {
        const { cache } = get();
        const docId = id || doctype;
        return cache[doctype]?.[docId]?.doc || null;
    },
    invalidate: (doctype: string, id?: string) => {
        const { cache } = get();
        if (cache[doctype]) {
            const newCache = { ...cache };
            if (id) {
                // Invalidate specific doc
                const newDoctypeCache = { ...newCache[doctype] };
                delete newDoctypeCache[id];
                newCache[doctype] = newDoctypeCache;
            } else {
                // Invalidate all docs for this doctype
                delete newCache[doctype];
            }
            set({ cache: newCache });
        }
    },
    clearCache: () => {
        set({ cache: {} });
    },
    isLoaded: (doctype: string, id?: string) => {
        const { cache } = get();
        const docId = id || doctype;
        return cache[doctype]?.[docId]?.isLoaded || false;
    },
}));

// Track pending fetches per doctype to prevent overlapping requests
const pendingFetches = new Map<string, Promise<any>>();

interface useDocAllOptions<DT extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DT;
    // Optional: document id (for non-single doctypes). If not provided, uses doctype name as id (for single doctypes)
    id?: string;
    // Optional: force refetch even if cached
    forceRefetch?: boolean;
    // Optional: cache TTL in milliseconds (default: no expiration)
    cacheTTL?: number;
    // Optional: fields to fetch
    fields?: string[];
}

interface useDocAllResult<TDoc extends Record<string, any> = Record<string, any>> {
    doc: TDoc | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
    invalidate: () => void;
}

/**
 * Hook to fetch a single doctype (for single doctypes like Global Setting) with persistent caching
 * 
 * Features:
 * - Fetches single doctype using doctype name as id
 * - Caches results in memory (session-only, cleared on page reload)
 * - Only fetches once per session unless explicitly invalidated
 * - Prevents duplicate concurrent requests
 * 
 * @param options - Configuration for the doc query
 * @returns Doc result with cached data
 */
export function useDocAll<DT extends Zodula.DoctypeName = Zodula.DoctypeName, TDoc extends Zodula.SelectDoctype<DT> = Zodula.SelectDoctype<DT>>(
    options: useDocAllOptions<DT>
): useDocAllResult<TDoc> {
    const { doctype, id, forceRefetch = false, cacheTTL, fields } = options;
    
    // For single doctypes, use doctype as id when id is not provided
    const effectiveId = id || doctype;
    
    const { cache, setDoc, getDoc, invalidate: invalidateStore, isLoaded: isLoadedStore } = useDocAllStore();

    // Get cached doc
    const cachedDoc = useMemo(() => {
        if (!doctype) return null;
        
        const cached = getDoc(doctype, effectiveId);
        if (!cached) return null;

        // Check cache TTL if provided
        if (cacheTTL) {
            const cacheEntry = cache[doctype]?.[effectiveId];
            if (cacheEntry && Date.now() - cacheEntry.lastFetched > cacheTTL) {
                return null; // Cache expired
            }
        }

        return cached as TDoc;
    }, [doctype, effectiveId, cache, getDoc, cacheTTL]);

    const [doc, setDocState] = useState<TDoc | null>(cachedDoc);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const initializedRef = useRef<string | null>(null);

    const fetchDoc = useCallback(async () => {
        if (!doctype) {
            setDocState(null);
            setLoading(false);
            setError(null);
            return;
        }

        // Check if already loaded in this session and not forcing refetch
        if (!forceRefetch && isLoadedStore(doctype, effectiveId) && cachedDoc) {
            setDocState(cachedDoc);
            setLoading(false);
            setError(null);
            return;
        }

        // Check if there's already a pending fetch for this doctype+id
        const fetchKey = `${doctype}:${effectiveId}`;
        const pendingFetch = pendingFetches.get(fetchKey);
        if (pendingFetch) {
            // Wait for the existing fetch to complete
            try {
                const result = await pendingFetch;
                setDocState(result);
                setLoading(false);
                setError(null);
            } catch (e: any) {
                setError(e?.message || "Failed to load doc");
                setLoading(false);
            }
            return;
        }

        // Start a new fetch
        setLoading(true);
        setError(null);

        const fetchPromise = (async () => {
            try {
                // Use effectiveId (either provided id or doctype name for single doctypes)
                const response = await zodula?.doc?.get_doc(doctype, effectiveId, {
                    fields: fields && fields.length > 0 ? fields : undefined,
                });
                
                const fetchedDoc = response as TDoc | null;
                
                // Cache the result
                setDoc(doctype, fetchedDoc, effectiveId);
                
                return fetchedDoc;
            } catch (e: any) {
                throw e;
            }
        })();

        pendingFetches.set(fetchKey, fetchPromise);

        try {
            const result = await fetchPromise;
            setDocState(result);
            setLoading(false);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Failed to load doc");
            setLoading(false);
        } finally {
            pendingFetches.delete(fetchKey);
        }
    }, [doctype, effectiveId, forceRefetch, isLoadedStore, cachedDoc, setDoc, fields]);

    // Fetch on mount if not cached or if forcing refetch
    useEffect(() => {
        // Reset initialization when doctype or id changes
        const initKey = `${doctype}:${effectiveId}`;
        if (initializedRef.current !== initKey) {
            initializedRef.current = null;
        }

        // If we have cached data and not forcing refetch, use it
        if (cachedDoc && !forceRefetch && initializedRef.current !== initKey) {
            setDocState(cachedDoc);
            setLoading(false);
            initializedRef.current = initKey;
            return;
        }

        // If already initialized for this doctype+id and not forcing refetch, skip
        if (initializedRef.current === initKey && !forceRefetch) {
            return;
        }

        // Fetch data
        fetchDoc();
        initializedRef.current = initKey;
    }, [doctype, effectiveId, forceRefetch, cachedDoc, fetchDoc]);

    const reload = useCallback(async () => {
        if (!doctype) return;

        // Clear any pending fetches
        const fetchKey = `${doctype}:${effectiveId}`;
        pendingFetches.delete(fetchKey);

        // Force refetch
        await fetchDoc();
    }, [doctype, effectiveId, fetchDoc]);

    const invalidate = useCallback(() => {
        if (!doctype) return;
        invalidateStore(doctype, effectiveId);
        setDocState(null);
    }, [doctype, effectiveId, invalidateStore]);

    return {
        doc: doc || null,
        loading,
        error,
        reload,
        invalidate,
    };
}

