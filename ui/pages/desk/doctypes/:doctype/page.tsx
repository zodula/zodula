import React, { useEffect } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { DocFormView } from "@/zodula/ui/views/doc-form-view";
import ErrorView from "@/zodula/ui/views/error-view";

export default function DoctypePage() {
    const { params, push, replace } = useRouter();
    const doctype = params.doctype as Zodula.DoctypeName;
    // Get doctype metadata to check if it's single
    const { doc: doctypeDoc, loading } = useDocAll({
        doctype: "Doctype",
        id: doctype
    });

    // Redirect to list if not a single doctype
    useEffect(() => {
        if (doctypeDoc && !doctypeDoc.is_single) {
            replace(`/desk/doctypes/${doctype}/list`);
        }
    }, [doctypeDoc, push, doctype]);

    if (loading) {
        return (
            <div className="zd:flex zd:items-center zd:justify-center zd:h-64">
                <div className="zd:text-muted-foreground">Loading...</div>
            </div>
        );
    }

    // If doctype is single, show the form view
    if (doctypeDoc?.is_single) {
        const id = doctype;
        const formId = `create|${doctype}`;
        return (
            <DocFormView id={id} doctype={doctype} formId={formId} />
        );
    }

    // This should not render as we redirect above, but just in case
    return <ErrorView message="Something went wrong" status={404} />
}
