import { useCallback, useEffect, useState, useMemo } from "react";
import { zodula } from "@/zodula/client";
import { useDocListAll } from "./use-doc-list-all";

// Track pending fetches per doctype+id to prevent overlapping requests
const pendingFetches = new Map<string, Promise<any>>();

interface useDocOptions<DT extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DT;
    id: string;
    fields?: string[];
    isSingle?: boolean;
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
    const { doctype, id, fields = [], isSingle = false } = options;

    const [doc, setDoc] = useState<TDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // For single doctypes, use doctype as id when id is empty or undefined
    const effectiveId = useMemo(() => id, [id]);

    // Fetch all doctype relatives with persistent caching, then filter client-side
    const { docs: allRelatives, loading: relativeLoading, error: relativeError, reload: reloadRelatives } = useDocListAll({
        doctype: "zodula__Doctype Relative"
    });

    // Filter relatives by parent_doctype
    const relatives = useMemo(() => {
        return allRelatives.filter((relative) => relative.parent_doctype === doctype);
    }, [allRelatives, doctype]);

    const loadDoc = useCallback(async () => {
        if (!doctype || !effectiveId) {
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
                const response = await zodula?.doc?.get_doc(doctype as Zodula.DoctypeName, effectiveId, {
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

    useEffect(() => {
        loadDoc();
    }, [...deps, effectiveId, doctype]);

    const reload = useCallback(async () => {
        if (!doctype) return;

        // Clear any pending fetches for this doc
        const fetchKey = `${doctype}:${effectiveId}`;
        pendingFetches.delete(fetchKey);

        // Refetch immediately
        await loadDoc();
    }, [doctype, effectiveId, loadDoc]);

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
