import React from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { DocFormView } from "@/zodula/ui/views/doc-form-view";

export default function FormPage() {
    const { params, location } = useRouter();
    const doctype = params.doctype as Zodula.DoctypeName;
    const prefill = location.state?.prefill;
    const cbUrl = location.state?.cbUrl;
    const fromField = location.state?.fromField;
    const resetForm = location.state?.resetForm;
    const tempId = `temp-${doctype}-new`
    const formId = `create|${doctype}`;

    return (
        <DocFormView
            id={tempId}
            prefill={prefill}
            doctype={doctype}
            cbUrl={cbUrl}
            fromField={fromField}
            resetForm={resetForm}
            mode="create"
            formId={formId}
        />
    );
}
