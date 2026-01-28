import { useCallback, useEffect, useState, useRef } from "react";
import { zodula } from "@/zodula/client";
import { useDocList } from "./use-doc-list";

// Track pending fetches per doctype+id to prevent overlapping requests
const pendingFetches = new Map<string, Promise<any>>();

interface useDocOptions<DT extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DT;
    id?: string;
    fields?: string[];
}

interface useDocResult<TDoc extends Zodula.SelectDoctype<Zodula.DoctypeName> = Zodula.SelectDoctype<Zodula.DoctypeName>> {
    doc: TDoc | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
    relativeLoading: boolean;
    relativeError: string | null;
    relatives: Zodula.SelectDoctype<"zodula__Doctype Relative">[];
    reloadRelatives: () => void;
}

export function useDoc<DT extends Zodula.DoctypeName = Zodula.DoctypeName, TDoc extends Zodula.SelectDoctype<DT> = Zodula.SelectDoctype<DT>>(
    options: useDocOptions<DT>,
    deps: any[] = []
): useDocResult<TDoc> {
    const { doctype, id, fields = [] } = options;

    const [doc, setDoc] = useState<TDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // For single doctypes, use doctype as id when id is empty or undefined
    const effectiveId = id || doctype;

    const { docs: relatives, loading: relativeLoading, error: relativeError, reload: reloadRelatives } = useDocList({
        doctype: "zodula__Doctype Relative",
        filters: [
            ["parent_doctype", "=", doctype]
        ],
        limit: 1000,
    }, [doctype, id, effectiveId, ...deps]);

    const loadDoc = useCallback(async () => {
        if (!doctype) {
            setDoc(null);
            setLoading(false);
            setError(null);
            return;
        }

        // Create a unique key for this doctype+id combination
        const fetchKey = `${doctype}:${effectiveId}`;

        // Check if there's already a pending fetch for this doc
        const pendingFetch = pendingFetches.get(fetchKey);
        if (pendingFetch) {
            // Wait for the existing fetch to complete
            try {
                const result = await pendingFetch;
                setDoc(result);
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
                const response = await zodula?.doc?.get_doc(doctype as Zodula.DoctypeName, id, {
                    fields: fields && fields.length > 0 ? fields : undefined,
                });
                return response as TDoc;
            } catch (e: any) {
                throw e;
            }
        })();

        pendingFetches.set(fetchKey, fetchPromise);

        try {
            const result = await fetchPromise;
            setDoc(result);
            setLoading(false);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Failed to load doc");
            setLoading(false);
        } finally {
            pendingFetches.delete(fetchKey);
        }
    }, [doctype, id, effectiveId, fields]);

    // Debounced fetch function
    const debouncedLoadDoc = useCallback(() => {
        // Clear existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Set new timeout for debouncing
        debounceTimeoutRef.current = setTimeout(() => {
            loadDoc();
        }, 300); // 300ms debounce
    }, []);

    useEffect(() => {
        debouncedLoadDoc();

        // Cleanup timeout on unmount or when deps change
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [...deps]);

    const reload = useCallback(async () => {
        if (!doctype) return;

        // Clear debounce timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Clear any pending fetches for this doc
        const fetchKey = `${doctype}:${effectiveId}`;
        pendingFetches.delete(fetchKey);

        // Refetch immediately (bypass debounce)
        await loadDoc();
    }, [doctype, effectiveId]);

    return {
        doc,
        loading,
        error,
        reload,
        relativeLoading,
        relativeError,
        relatives: doctype ? relatives : [],
        reloadRelatives,
    };
}
