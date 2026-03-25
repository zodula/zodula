import React from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { DocFormView } from "@/zodula/ui/views/doc-form-view";

export default function FormPage() {
  const { params, location } = useRouter();
  const doctype = params.doctype as Zodula.DoctypeName;
  const id = params.id as string;
  const prefill = location.state?.prefill;
  const formId = `edit|${doctype}|${id}`;
  return (
    <DocFormView doctype={doctype} id={id} prefill={prefill} formId={formId} />
  );
}
