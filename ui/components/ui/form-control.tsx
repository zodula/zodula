import * as React from "react";
import { cn } from "../../lib/utils";
import { plugins } from "../form/plugins";

export interface FormControlProps {
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  readonly?: boolean;
  children?: React.ReactNode;
  className?: string;
  type?: string;
  noPrint?: boolean;
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
}

const FormControl = React.forwardRef<HTMLDivElement, FormControlProps>(
  ({
    label,
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
    fieldPath
  }, ref) => {

    // If field is provided, render the field plugin
    const fieldContent = field ? (() => {
      const plugin = plugins.find(plugin => plugin.types.find(type => type === field.type)) as any;

      if (!plugin) {
        return <div>Field not supported: {field.type}</div>;
      }

      return (
        <div
          id={`form-control-${fieldKey}`}
          data-form-control-type={field.type}
          data-form-control-id={fieldKey}
          data-form-control-value={value}
          data-form-control-readonly={readonly}
          data-form-control-required={required}
          data-form-control-multiple={multiple}
          data-form-control-form-data={formData}
          data-form-control-no-print={noPrint}
        >
          <plugin.render
            fieldOptions={field}
            value={value}
            multiple={multiple}
            fieldKey={fieldKey}
            onChange={(newValue: any) => {
              // Don't allow changes if field is readonly
              if (!readonly && onChange && fieldKey) {
                onChange(fieldKey, newValue);
              }
            }}
            onBlur={(newValue: any) => {
              if (onBlur && fieldKey) {
                onBlur(fieldKey, newValue);
              }
            }}
            readonly={readonly}
            formData={formData}
            fieldPath={fieldPath}
            docId={docId}
          />
        </div>
      );
    })() : children;

    // If hideFormControl is true, just return the field content
    if (hideFormControl) {
      return <div className={cn("zd:w-full", className ?? "")} ref={ref}>{fieldContent}</div>;
    }

    return (
      <div className={cn("zd:w-full",
        className ?? "",
        noPrint ? "no-print" : "")} ref={ref}>
        {label && (
          <div className="zd:flex zd:items-center zd:mb-2 zd:text-sm">
            <label className="zd:text-muted-foreground zd:flex zd:items-center">
              {label}
              {!!required && <span className="zd:text-red-500 zd:ml-1 no-print">*</span>}
            </label>
          </div>
        )}

        {fieldContent}

        {(error || helperText) && (
          <p className={cn(
            "zd:mt-1 zd:text-xs",
            error ? "zd:text-destructive" : "zd:text-muted-foreground"
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

FormControl.displayName = "FormControl";

export { FormControl }; 