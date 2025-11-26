import { create } from "zustand";
import { zodula } from "@/zodula/client";

interface DocCache {
    [doctype: string]: {
        [id: string]: {
            data: any;
            loading: boolean;
            error: string | null;
            lastFetched: number;
        };
    };
}

interface DocCacheItem {
    data: any;
    loading: boolean;
    error: string | null;
    lastFetched: number;
}

interface DocStore {
    cache: DocCache;
    fetchDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        id?: string,
        fields?: string[]
    ) => Promise<void>;
    getDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        id?: string
    ) => {
        data: any;
        loading: boolean;
        error: string | null;
    } | null;
    invalidateDoc: (doctype: string, id?: string) => void;
    invalidateDoctype: (doctype: string) => void;
    clearCache: () => void;
}

export const useDocStore = create<DocStore>((set, get) => ({
    cache: {},

    fetchDoc: async <DT extends Zodula.DoctypeName>(
        doctype: DT,
        id?: string,
        fields?: string[]
    ) => {
        const { cache } = get();
        
        // For single doctypes, use doctype as cache key when no id provided
        const cacheKey = id || doctype;
        
        // Create new cache object to avoid mutation
        const newCache = { ...cache };
        
        // Initialize doctype cache if it doesn't exist
        if (!newCache[doctype]) {
            newCache[doctype] = {};
        }

        // Set loading state
        const loadingItem: DocCacheItem = {
            data: newCache[doctype]?.[cacheKey]?.data || null,
            loading: true,
            error: null,
            lastFetched: newCache[doctype]?.[cacheKey]?.lastFetched || 0,
        };

        set({
            cache: {
                ...newCache,
                [doctype]: {
                    ...newCache[doctype],
                    [cacheKey]: loadingItem,
                },
            },
        });

        try {
            const response = await zodula?.doc?.get_doc(doctype as Zodula.DoctypeName, id, {
                fields: fields && fields.length > 0 ? fields : undefined,
            });

            // Get fresh cache state for successful response
            const { cache: currentCache } = get();
            const updatedCache = { ...currentCache };
            if (!updatedCache[doctype]) {
                updatedCache[doctype] = {};
            }

            // Update cache with successful response
            const successItem: DocCacheItem = {
                data: response,
                loading: false,
                error: null,
                lastFetched: Date.now(),
            };

            set({
                cache: {
                    ...updatedCache,
                    [doctype]: {
                        ...updatedCache[doctype],
                        [cacheKey]: successItem,
                    },
                },
            });

        } catch (e: any) {
            // Get fresh cache state for error response
            const { cache: currentCache } = get();
            const updatedCache = { ...currentCache };
            if (!updatedCache[doctype]) {
                updatedCache[doctype] = {};
            }

            // Update cache with error
            const errorItem: DocCacheItem = {
                data: null,
                loading: false,
                error: e?.message || "Failed to load doc",
                lastFetched: updatedCache[doctype]?.[cacheKey]?.lastFetched || 0,
            };

            set({
                cache: {
                    ...updatedCache,
                    [doctype]: {
                        ...updatedCache[doctype],
                        [cacheKey]: errorItem,
                    },
                },
            });
        }
    },

    getDoc: <DT extends Zodula.DoctypeName>(
        doctype: DT,
        id?: string
    ) => {
        const { cache } = get();
        const cacheKey = id || doctype;
        return cache[doctype]?.[cacheKey] || null;
    },

    invalidateDoc: (doctype: string, id?: string) => {
        const { cache } = get();
        const cacheKey = id || doctype;
        if (cache[doctype]?.[cacheKey]) {
            const newCache = { ...cache };
            const newDoctypeCache = { ...newCache[doctype] };
            delete newDoctypeCache[cacheKey];
            newCache[doctype] = newDoctypeCache;
            set({ cache: newCache });
        }
    },

    invalidateDoctype: (doctype: string) => {
        const { cache } = get();
        if (cache[doctype]) {
            const newCache = { ...cache };
            delete newCache[doctype];
            set({ cache: newCache });
        }
    },

    clearCache: () => {
        set({ cache: {} });
    },
}));
