import React, { useEffect } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { DocFormView } from "@/zodula/ui/views/doc-form-view";

export default function FormPage() {
    const { params, location, replace, pathname } = useRouter();
    const doctype = params.doctype as Zodula.DoctypeName;
    const prefill = location.state?.prefill;
    const cbUrl = location.state?.cbUrl;
    const fromField = location.state?.fromField;
    const fromDoc = location.state?.fromDoc;
    const resetForm = location.state?.resetForm

    return (
        <div className="zd:pb-16">
            <DocFormView
                doctype={doctype}
                prefill={prefill}
                cbUrl={cbUrl}
                fromField={fromField}
                fromDoc={fromDoc}
                resetForm={resetForm}
                mode="create"
            />
        </div>
    );
}
