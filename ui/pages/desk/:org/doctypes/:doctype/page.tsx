import React, { useEffect } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { DocFormView } from "@/zodula/ui/views/doc-form-view";
import ErrorView from "@/zodula/ui/views/error-view";
import { useParams } from "react-router";

export default function DoctypePage() {
    const { params, push, replace } = useRouter();
    const doctype = params.doctype as Zodula.DoctypeName;
    const { org } = useParams();
    // Get doctype metadata to check if it's single
    const { doc: doctypeDoc, loading } = useDocAll({
        doctype: "Doctype",
        id: doctype
    });

    // Redirect to list if not a single/org-single doctype
    useEffect(() => {
        if (doctypeDoc && !doctypeDoc.is_single && !doctypeDoc.is_organization_single) {
            replace(`/desk/${org}/doctypes/${doctype}/list`);
        }
    }, [doctypeDoc, push, doctype, org]);

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

    // If doctype is org-single, show the form view for this org's singleton document
    if (doctypeDoc?.is_organization_single) {
        const id = `${doctype} - ${org}` as any;
        const formId = `edit|${doctype}|${id}`;
        return (
            <DocFormView id={id} doctype={doctype} formId={formId} />
        );
    }

    // This should not render as we redirect above, but just in case
    return <ErrorView message="Something went wrong" status={404} />
}
