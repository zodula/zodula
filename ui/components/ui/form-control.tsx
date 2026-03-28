import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { plugins } from "../form/plugins";
import { Tooltip } from "./tooltip";
import { Button } from "./button";

export interface FormControlProps {
  label?: string;
  name?: string;
  id?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  readonly?: boolean;
  children?: React.ReactNode;
  className?: string;
  type?: string;
  noPrint?: boolean;
  doctype?: Zodula.DoctypeConfig;
  placeholder?: string;
  // Field-specific props
  field?: any;
  fieldKey: string;
  value?: any;
  onChange?: (fieldName: string, value: any) => void;
  onBlur?: (fieldName: string, value: any) => void;
  multiple?: boolean;
  hideFormControl?: boolean;

  formData?: any;
  docId?: string;
  fieldPath?: string; // The nested field path for reference table fields
  showDescription?: boolean;

  referenceTableFields?: Record<string, any>;
  extendFields?: Record<string, any>;
  referenceTableIndexFields?: Record<string, { idx: number, fields: Zodula.SelectDoctype<"Field">[]}[]>;
  /** Buttons to render next to the field label (e.g. "Select Price"). */
  fieldButtons?: { label: string; run: () => void | Promise<void> }[];
}

const FormControl = React.forwardRef<HTMLDivElement, FormControlProps>(
  (
    {
      label,
      name,
      id,
      error,
      helperText,
      required,
      readonly,
      children,
      className,
      field,
      fieldKey,
      value,
      onChange,
      onBlur,
      multiple,
      hideFormControl,
      formData,
      noPrint,
      docId,
      fieldPath,
      showDescription = true,
      referenceTableFields,
      referenceTableIndexFields,
      extendFields,
      doctype,
      placeholder,
      fieldButtons,
    },
    ref
  ) => {
    // If field is provided, render the field plugin
    const fieldContent = field
      ? (() => {
        const plugin = plugins.find((plugin) =>
          plugin.types.find((type) => type === field.type)
        ) as any;

        if (!plugin) {
          return <div>Field not supported: {field.type}</div>;
        }

        return (
          <div
            id={id || `form-control-${fieldKey}`}
            data-form-control-type={field.type}
            data-form-control-id={fieldKey}
            data-form-control-value={value}
            data-form-control-readonly={readonly}
            data-form-control-required={required}
            data-form-control-multiple={multiple}
            data-form-control-form-data={formData}
            data-form-control-no-print={noPrint}
            className=""
          >
            <plugin.render
              id={id || fieldKey}
              fieldOptions={field}
              value={value}
              multiple={multiple}
              fieldKey={fieldKey}
              onChange={(fieldPath: string, newValue: any) => {
                // Don't allow changes if field is readonly
                if (!readonly && onChange && fieldKey) {
                  onChange(fieldPath || fieldKey, newValue);
                }
              }}
              onBlur={(fieldPath: string, newValue: any) => {
                if (onBlur && fieldKey) {
                  onBlur(fieldPath, newValue);
                }
              }}
              readonly={readonly}
              formData={formData}
              fieldPath={fieldPath}
              docId={docId}
              referenceTableFields={referenceTableFields}
              extendFields={extendFields}
              referenceTableIndexFields={referenceTableIndexFields}
              doctype={doctype}
              placeholder={placeholder}
            />
          </div>
        );
      })()
      : children;

    // If hideFormControl is true, just return the field content
    if (hideFormControl) {
      return (
        <div className={cn("zd:w-full", className ?? "")} ref={ref}>
          {fieldContent}
        </div>
      );
    }

    return (
      <div
        className={cn("zd:w-full", className ?? "", noPrint ? "no-print" : "")}
        ref={ref}
      >
        {label && (
          <div className="zd:font-medium zd:flex zd:items-center zd:gap-1.5 zd:mb-2 zd:text-sm zd:flex-wrap">
            <label className="zd:text-muted-foreground zd:flex zd:items-center zd:whitespace-nowrap">
              {label}
              {!!required && (
                <span className="zd:text-red-500 zd:ml-1 no-print">*</span>
              )}
            </label>
            {!!field?.description && showDescription && (
              <Tooltip content={field.description} side="top" align="center">
                <span className="zd:inline-flex zd:items-center zd:text-muted-foreground zd:cursor-help no-print">
                  <Info className="zd:h-3.5 zd:w-3.5" />
                </span>
              </Tooltip>
            )}
            {fieldButtons?.map((btn, i) => (
              <Button
                key={i}
                type="button"
                variant="outline"
                size="sm"
                className="zd:ml-1 no-print"
                onClick={() => btn.run()}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        )}

        {fieldContent}

        {(error || helperText) && (
          <p
            className={cn(
              "zd:mt-1 zd:text-xs",
              error ? "zd:text-destructive" : "zd:text-muted-foreground"
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

FormControl.displayName = "FormControl";

export { FormControl };



