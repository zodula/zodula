import { useCallback, useEffect, useMemo, useState } from "react";
import { useDocStore } from "./use-doc-store";
import { useDocList } from "./use-doc-list";

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

    const { fetchDoc, getDoc, invalidateDoc } = useDocStore();

    // For single doctypes, use doctype as id when id is empty or undefined
    // For regular doctypes, require an id
    const effectiveId = id || doctype;

    // Get cached data from store
    const cachedData = useMemo(() => {
        if (!doctype) return null;
        return getDoc(doctype, effectiveId);
    }, [doctype, effectiveId, getDoc, deps]);

    const doc = cachedData?.data as TDoc | null;
    const loading = cachedData?.loading || false;
    const error = cachedData?.error || null;

    const { docs: relatives, loading: relativeLoading, error: relativeError, reload: reloadRelatives } = useDocList({
        doctype: "zodula__Doctype Relative",
        filters: [
            ["parent_doctype", "=", doctype]
        ],
        limit: 1000,
    }, [doctype, id, effectiveId, ...deps]);

    const loadDoc = useCallback(async () => {
        if (!doctype) return;

        // Check if we already have data and it's not loading
        const existing = getDoc(doctype, effectiveId);
        if (existing?.data && !existing.loading) {
            return; // Data already exists and is not loading
        }

        // For single doctypes, pass undefined as id to let the API handle it
        await fetchDoc(doctype, id, fields);
    }, [doctype, id, effectiveId, fields, fetchDoc, getDoc]);

    useEffect(() => {
        loadDoc();
    }, [...deps]);

    const reload = useCallback(async () => {
        if (!doctype) return;

        // Invalidate cache and refetch
        invalidateDoc(doctype, effectiveId);

        const _relatives = relatives.filter((relative) => relative.child_doctype === doctype);
        for (const relative of _relatives) {
            const relativeId = doc?.[relative.child_field_name as keyof TDoc];
            invalidateDoc(relative.parent_doctype, relativeId as string);
        }
        await loadDoc();
    }, [doctype, effectiveId, invalidateDoc, loadDoc]);

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
