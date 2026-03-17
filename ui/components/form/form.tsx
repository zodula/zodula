import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs, Section, FormControl } from "@/zodula/ui";
import { useTranslation } from "../../hooks/use-translation";
import { zodula } from "@/zodula/client";
import { cn } from "../../lib/utils";

interface LayoutItem {
  type: string;
  value: string | string[];
  align: string;
  label_align: string;
}

interface TabConfig {
  label: string;
  layout: LayoutItem[] | LayoutItem[][];
}

interface FormProps<T extends Record<string, Zodula.Field>> {
  isCreate?: boolean;
  fields: T;
  referenceTableFields?: Record<string, any>;
  extendFields?: Record<string, any>;
  values?: Partial<T>;
  onChange?: (fieldName: keyof T, value: any) => void;
  readonly?: boolean;
  docId?: string;
  doctype?: Zodula.DoctypeConfig;
  debug?: boolean;
  tabs?: TabConfig[];
  translate?: boolean;
  enableScripts?: boolean;
  hasPrefill?: boolean;
  childExtendFieldPropertyOverrides?: Record<
    string,
    Record<string, Record<string, any>>
  >;
  childTableFieldPropertyOverrides?: Record<
    string,
    Record<number, Record<string, Record<string, any>>>
  >;
  referenceTableIndexFields?: Record<string, { idx: number, fields: Zodula.SelectDoctype<"Field">[] }[]>;
  onNestedFieldChange?: (nestedFieldPath: string, value: any, oldValue: any, idx?: number) => Promise<void>;
  /** Buttons to show next to field labels; key = field name. */
  fieldButtons?: Record<string, { label: string; run: () => void | Promise<void> }[]>;
}

export const Form = <T extends Record<string, Zodula.Field>>(
  props: FormProps<T>
) => {
  const [activeTab, setActiveTab] = useState<string>("");
  const tabsToUse = props.tabs;
  const { t } = useTranslation();

  const translateText = useCallback(
    (text: string) => (props.translate ? t(text) : text),
    [props.translate, t]
  );

  const handleChange = useCallback(
    (fieldName: keyof T, value: any) => {
      props.onChange?.(fieldName, value);
    },
    [props.onChange]
  );

  const { tabs, sectionsByTab, hasTabFields, tabHasRequired } = useMemo(() => {
    const tabs: string[] = [];
    const sectionsByTab: Record<
      string,
      Array<{
        sectionName: string;
        rows: Array<{
          fields: Array<{ key: string; field: Zodula.Field }>;
          columns: number;
        }>;
        collapsible: number;
        defaultCollapsed: number;
      }>
    > = {};

    if (tabsToUse && tabsToUse.length > 0) {
      tabsToUse.forEach((tabConfig) => {
        const { label, layout } = tabConfig;
        tabs.push(label);
        sectionsByTab[label] = [];

        let currentSection = t("General");
        let currentRows: Array<{
          fields: Array<{ key: string; field: Zodula.Field }>;
          columns: number;
        }> = [];

        sectionsByTab[label].push({
          sectionName: currentSection,
          rows: [],
          collapsible: 0,
          defaultCollapsed: 0,
        });

        layout.forEach((item) => {
          if (typeof item === "object" && item !== null) {
            const layoutItem = item as LayoutItem;

            if (layoutItem.type === "section") {
              if (currentRows.length > 0) {
                const lastSectionIndex =
                  (sectionsByTab[label]?.length || 0) - 1;
                const lastSection =
                  lastSectionIndex !== undefined
                    ? sectionsByTab[label]?.[lastSectionIndex]
                    : undefined;
                if (lastSection) {
                  lastSection.rows = [...currentRows];
                }
              }

              currentSection =
                typeof layoutItem.value === "string"
                  ? layoutItem.value
                  : layoutItem.value[0] || "";
              currentRows = [];

              if (sectionsByTab[label]) {
                sectionsByTab[label].push({
                  sectionName: currentSection,
                  rows: [],
                  collapsible: 0,
                  defaultCollapsed: 0,
                });
              }
            } else if (layoutItem.type === "field" && layoutItem.value) {
              const fieldName =
                typeof layoutItem.value === "string"
                  ? layoutItem.value
                  : layoutItem.value[0];
              if (fieldName && props.fields[fieldName]) {
                currentRows.push({
                  fields: [
                    {
                      key: fieldName,
                      field: props.fields[fieldName],
                    },
                  ],
                  columns: 1,
                });
              }
            } else if (Array.isArray(item)) {
              const rowFields: Array<{ key: string; field: Zodula.Field }> = [];

              item.forEach((fieldItem) => {
                if (typeof fieldItem === "object" && fieldItem !== null) {
                  const fieldLayoutItem = fieldItem as LayoutItem;

                  if (
                    fieldLayoutItem.type === "field" &&
                    fieldLayoutItem.value
                  ) {
                    const fieldName =
                      typeof fieldLayoutItem.value === "string"
                        ? fieldLayoutItem.value
                        : fieldLayoutItem.value[0];
                    if (fieldName && props.fields[fieldName]) {
                      rowFields.push({
                        key: fieldName,
                        field: props.fields[fieldName],
                      });
                    }
                  } else if (fieldLayoutItem.type === "empty") {
                    rowFields.push({
                      key: `empty_${rowFields.length}`,
                      field: {
                        type: "Data",
                        label: "",
                        required: 0,
                        readonly: 1,
                        hidden: 0,
                      } as Zodula.Field,
                    });
                  }
                }
              });

              if (rowFields.length > 0) {
                currentRows.push({
                  fields: rowFields,
                  columns: rowFields.length,
                });
              }
            }
          }
        });

        if (currentRows.length > 0) {
          const lastSectionIndex = sectionsByTab[label].length - 1;
          const lastSection = sectionsByTab[label][lastSectionIndex];
          if (lastSection) {
            lastSection.rows = [...currentRows];
          }
        }
      });

      const usedFields = new Set<string>();
      Object.values(sectionsByTab).forEach((sections) => {
        sections.forEach((section) => {
          section.rows.forEach((row) => {
            row.fields.forEach(({ key }) => {
              usedFields.add(key);
            });
          });
        });
      });

      const remainingFields = Object.entries(props.fields)
        .filter(([key]) => !usedFields.has(key))
        .map(([key, field]) => ({ key, field }));

      if (remainingFields.length > 0) {
        const lastTab = tabs[tabs.length - 1];
        if (lastTab && sectionsByTab[lastTab]) {
          sectionsByTab[lastTab].push({
            sectionName: t("Additional"),
            rows: [
              {
                fields: remainingFields,
                columns: 1,
              },
            ],
            collapsible: 0,
            defaultCollapsed: 0,
          });
        }
      }

      const filteredTabs = tabs.filter((tab) => (sectionsByTab[tab]?.length || 0) > 0);
      const tabHasRequired: Record<string, boolean> = {};
      filteredTabs.forEach((tab) => {
        const sections = sectionsByTab[tab] || [];
        tabHasRequired[tab] = sections.some((section) =>
          section.rows.some((row) =>
            row.fields.some(({ key, field }) => {
              if (key.startsWith("empty_")) return false;
              const formatted = zodula.utils.getFormatFieldConfig(field, props.values);
              return formatted?.hidden !== 1 && formatted?.required === 1;
            })
          )
        );
      });

      return {
        tabs: filteredTabs,
        sectionsByTab,
        hasTabFields: 1,
        tabHasRequired,
      };
    }

    const allFields = Object.entries(props.fields).map(([key, field]) => ({
      key,
      field,
    }));

    const mainHasRequired = allFields.some(({ field }) => field.required === 1);
    return {
      tabs: ["Main"],
      sectionsByTab: {
        Main: [
          {
            sectionName: t("General"),
            rows: [
              {
                fields: allFields,
                columns: 1,
              },
            ],
            collapsible: 0,
            defaultCollapsed: 0,
          },
        ],
      },
      hasTabFields: 0,
      tabHasRequired: { Main: mainHasRequired },
    };
  }, [props.fields, props.values, tabsToUse, t]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (tabs.length > 0 && !activeTab) {
        setActiveTab(tabs[0] || "");
      }

      if (!tabs.includes(activeTab)) {
        setActiveTab(tabs[0] || "");
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [tabs, activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  if (tabs.length === 0) {
    return <div>{t("No fields")}</div>;
  }

  return (
    <div className="zd:space-y-6">
      {!!hasTabFields && (
        <Tabs
          translate={props.translate}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabHasRequired={tabHasRequired}
        />
      )}

      {sectionsByTab[activeTab]
        ?.filter(({ rows }) => {
          if (rows.length === 0) return false;
          const hasVisibleField = rows.some((row) =>
            row.fields.some(({ key, field: _field }) => {
              if (key.startsWith("empty_")) return false;
              const field = zodula.utils.getFormatFieldConfig(_field, props.values);
              return field?.hidden !== 1;
            })
          );
          return hasVisibleField;
        })
        .map(({ sectionName, rows, collapsible, defaultCollapsed }) => {
          return (
            <Section
              key={sectionName}
              title={translateText(sectionName)}
              hideLabel={sectionName === t("General")}
              collapsible={collapsible === 1}
              defaultCollapsed={defaultCollapsed === 1}
            >
              <div className="zd:space-y-4">
                {rows.map(({ fields, columns }, rowIndex) => (
                  <div
                    key={rowIndex}
                    className={cn("zd:gap-4 zd:grid",
                      columns === 1 ? "zd:grid-cols-1" : columns === 2 ? "zd:grid-cols-2" : columns === 3 ? "zd:grid-cols-3" : columns === 4 ? "zd:grid-cols-4" : columns === 5 ? "zd:grid-cols-5" : columns === 6 ? "zd:grid-cols-6" : "zd:grid-cols-1",
                      "zd:max-md:grid-cols-1"
                    )}
                  >
                    {fields.map(({ key, field: _field }) => {
                      const field = zodula.utils.getFormatFieldConfig(
                        _field,
                        props.values
                      );
                      const isFieldReadonly =
                        !!field.readonly ||
                        (field.only_once === 1 && props.isCreate === false)
                        props.readonly;
                      const isFieldRequired = field.required === 1;

                      if (key.startsWith("empty_")) {
                        return (
                          <div
                            key={key}
                            className="zd:opacity-0 zd:pointer-events-none"
                          >
                            <FormControl
                              placeholder="Empty"
                              doctype={props.doctype}
                              formData={props.values}
                              docId={props.docId}
                              fieldKey={key as string}
                              field={field}
                              value=""
                              onChange={() => { }}
                              readonly={true}
                              label=""
                              required={false}
                              noPrint={true}
                            />
                          </div>
                        );
                      }

                      if (field?.hidden === 1) {
                        return null;
                      }
                      return (
                        <FormControl
                          formData={props.values}
                          docId={props.docId}
                          key={key}
                          fieldKey={key as string}
                          field={field}
                          fieldPath={key as string}
                          name={field.name || key}
                          value={props.values?.[key as keyof T]}
                          onChange={handleChange}
                          readonly={isFieldReadonly}
                          label={translateText(field.label || key)}
                          required={isFieldRequired}
                          noPrint={
                            field.no_print === 1 ||
                            props.values?.[key as keyof T] === undefined ||
                            props.values?.[key as keyof T] === null
                          }
                          doctype={props.doctype}
                          referenceTableFields={props.referenceTableFields}
                          extendFields={props.extendFields}
                          referenceTableIndexFields={props.referenceTableIndexFields}
                          fieldButtons={props.fieldButtons?.[key as string]}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </Section>
          );
        })}
    </div>
  );
};

