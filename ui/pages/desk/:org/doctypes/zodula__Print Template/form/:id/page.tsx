import React from "react";
import { useParams } from "react-router";
import { PrintTemplateFormView } from "@/zodula/ui/components/custom/print-template-form-view";

export default function PrintTemplateEditPage() {
  const { id } = useParams();
  return <PrintTemplateFormView type="print_template" docId={id} />;
}
