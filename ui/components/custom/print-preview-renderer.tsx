import React, { useMemo, useEffect, useState, useRef } from "react";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { itemToElement } from "@/zodula/ui/components/custom/print-template-utils";
import { generateFixedPositionTemplateFromTabs, type PrintTemplateElement } from "@/zodula/client/code-utils";
import { PAGE_FORMATS } from "@/zodula/client/code-utils";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { zodula } from "@/zodula/client";
import { BASE_URL } from "@/zodula/client/utils";

interface PrintPreviewRendererProps {
  targetRef?: React.RefObject<HTMLDivElement>;
  doctype: string;
  docIds: string[];
  printTemplateId?: string | null;
  letterHeadId?: string | null;
  language?: string;
  org?: string;
}

// Helper to get field value from document (synchronous for regular fields)
function getFieldValue(doc: any, fieldName: string, orgDoc?: any): string {
  if (!doc || !fieldName) return "";

  // Handle organization fields
  if (fieldName.startsWith("organization.")) {
    const orgFieldName = fieldName.substring("organization.".length);
    if (orgDoc) {
      const value = orgDoc[orgFieldName];
      if (value === null || value === undefined) return "";
      return String(value);
    }
    return "";
  }

  const value = doc[fieldName];
  if (value === null || value === undefined) return "";
  return String(value);
}

// Helper to convert px to mm
function pxToMm(px: number): number {
  return (px * 25.4) / 96;
}

// Helper to convert mm to px
function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}

// Calculate anchor position
function calculateAnchorPosition(
  element: PrintTemplateElement,
  allElements: PrintTemplateElement[],
  visited: Set<string> = new Set()
): { x: number; y: number } {
  if (!element.anchorTo) {
    return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
  }

  if (visited.has(element.id)) {
    return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
  }
  visited.add(element.id);

  const anchorElement = allElements.find(
    (el) => (el.code && el.code === element.anchorTo) || el.id === element.anchorTo
  );

  if (!anchorElement) {
    return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
  }

  const anchorPos = calculateAnchorPosition(anchorElement, allElements, visited);
  const anchorHeight = anchorElement.transform?.height || 30;
  const offset = element.anchorOffset || { x: 0, y: 0 };
  const offsetX = typeof offset === "object" ? offset.x : (typeof offset === "number" ? offset : 0);
  let offsetY = typeof offset === "object" ? offset.y : (typeof offset === "number" ? offset : 0);

  // Adjust offsetY for measured heights if needed
  if (offsetY > 0 && offsetY > anchorHeight) {
    const spacing = offsetY - anchorHeight;
    offsetY = anchorHeight + spacing;
  }

  return {
    x: anchorPos.x + offsetX,
    y: anchorPos.y + offsetY,
  };
}

// Compute letter head block height in px (max bottom of all elements) for reserving space so template content sits below
function getLetterHeadHeightPx(elements: PrintTemplateElement[]): number {
  if (!elements.length) return 0;
  let maxBottom = 0;
  for (const el of elements) {
    const pos = calculateAnchorPosition(el, elements);
    const h = el.transform?.height || 30;
    const bottom = pos.y + h;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

// Reference Table Renderer Component (handles async data loading)
function ReferenceTableRenderer({
  element,
  doc,
  doctype,
  fieldName,
  fieldConfigs,
  childFieldConfigs,
  language,
  orgDoc,
  style,
  isFixedPosition,
}: {
  element: PrintTemplateElement;
  doc: any;
  doctype: string;
  fieldName: string;
  fieldConfigs: Map<string, { type: string; reference?: string }>;
  childFieldConfigs: Map<string, Map<string, { type: string }>>;
  language?: string;
  orgDoc?: any;
  style: React.CSSProperties;
  isFixedPosition: boolean;
}) {
  const { t } = useTranslation(language);
  const [fieldValueArray, setFieldValueArray] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReferenceTableData() {
      setIsLoading(true);

      let parentFieldValue = doc?.[fieldName];

      // If parentFieldValue is not an array, try to query it directly
      // This can happen if the document wasn't loaded with relationships
      if (!Array.isArray(parentFieldValue)) {
        // Try to get the field config to find the child doctype
        const fieldConfig = fieldConfigs.get(fieldName);

        if (fieldConfig?.reference) {
          try {
            // Query child documents directly
            const filters: any[] = [
              ["parentid", "=", doc.id],
              ["parentype", "=", doctype],
              ["parentfield", "=", fieldName],
            ];

            const result = await zodula?.doc?.select_docs(fieldConfig.reference as Zodula.DoctypeName, {
              limit: 1000,
              filters: filters as any,
              sort: "idx",
              order: "asc",
            });

            const childDocs = result?.docs || [];
            parentFieldValue = childDocs;
          } catch {
            // Query failed; keep parentFieldValue as non-array so we end up with []
          }
        }
      }

      const array = Array.isArray(parentFieldValue) ? parentFieldValue : [];
      setFieldValueArray(array);
      setIsLoading(false);
    }

    if (doc && fieldName && doctype) {
      loadReferenceTableData();
    } else {
      setIsLoading(false);
    }
  }, [doc, doctype, fieldName, fieldConfigs]);

  if (!element.fields || element.fields.length === 0) {
    return null;
  }

  const tableConfig = element.tableConfig || {};
  const columns = tableConfig.columns || element.fields.map((f, idx) => ({ field: f, order: idx }));
  const sortedColumns = [...columns].sort((a, b) => (a.order || 0) - (b.order || 0));
  const showHeader = tableConfig.showHeader !== false;
  const showBorder = tableConfig.showBorder !== false;
  // Row height from template table_config.rowHeight (pixels)
  const rowHeight = Number((tableConfig as any)?.rowHeight) || 20;
  // Check both element.hideNoValue and tableConfig.hideNoValue
  const hideNoValue = element.hideNoValue === true || tableConfig.hideNoValue === true;

  if (isLoading) {
    return <div data-item-id={element.id} style={style}>{t("Loading table data...")}</div>;
  }

  // Hide if hideNoValue is enabled and the array is empty (no rows)
  // Empty array [] should be treated as "no value"
  if (hideNoValue && (!fieldValueArray || fieldValueArray.length === 0)) {
    return null;
  }

  // Calculate table width in mm (matching PDF renderer)
  const elementWidthPx = element.transform?.width || 200;
  const elementWidthMm = pxToMm(elementWidthPx);

  const tableStyle: React.CSSProperties = {
    boxSizing: "border-box",
    width: `${elementWidthMm}mm`,
    borderCollapse: "collapse",
    tableLayout: "fixed",
    display: "table",
    margin: "0",
    backgroundColor: "transparent",
  };

  if (showBorder) {
    tableStyle.border = "1px solid #e5e7eb";
  }

  // Calculate column widths using percentages
  const specifiedWidths = sortedColumns.filter((col: any) => col.width).map((col: any) => col.width);
  const totalSpecifiedWidth = specifiedWidths.reduce((sum: number, w: number) => sum + w, 0);
  const columnsWithoutWidth = sortedColumns.length - sortedColumns.filter((col: any) => col.width).length;

  // Font size: prefer element.style.fontSize (from template), then style from parent, default 12px
  const rawFontSize =
    (element.style?.fontSize !== undefined && element.style?.fontSize !== null)
      ? element.style.fontSize
      : style.fontSize;
  const cellFontSizePx =
    rawFontSize === undefined || rawFontSize === null
      ? "12px"
      : typeof rawFontSize === "number"
        ? `${rawFontSize}px`
        : String(rawFontSize).endsWith("px")
          ? String(rawFontSize)
          : `${Number(rawFontSize) || 12}px`;

  // Base cell style: transparent background, tight line-height, font from template
  const cellStyle: React.CSSProperties = {
    boxSizing: "border-box",
    padding: "0 4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "top",
    margin: "0",
    display: "table-cell",
    minHeight: `${rowHeight}px`,
    height: `${rowHeight}px`,
    maxHeight: `${rowHeight}px`,
    lineHeight: 1,
    fontSize: cellFontSizePx,
    fontWeight: element.style?.fontWeight ?? style.fontWeight,
    fontStyle: element.style?.fontStyle ?? style.fontStyle,
    textDecoration: element.style?.textDecoration ?? style.textDecoration,
    color: element.style?.color ?? style.color ?? "#000",
    textAlign: style.textAlign,
    backgroundColor: "transparent",
  };

  if (showBorder) {
    cellStyle.border = "1px solid #e5e7eb";
  }

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: style.fontWeight || "600",
    borderBottom: showBorder ? "2px solid #e5e7eb" : undefined,
    display: "table-cell",
    minHeight: `${rowHeight}px`,
    height: `${rowHeight}px`,
    maxHeight: `${rowHeight}px`,
    backgroundColor: "transparent",
  };

  // Helper to get column width as percentage
  const getColumnWidth = (col: any): string => {
    if (col.width) {
      // Use specified percentage
      return `${col.width}%`;
    } else if (columnsWithoutWidth > 0) {
      // Distribute remaining percentage equally among unspecified columns
      const remainingPercentage = 100 - totalSpecifiedWidth;
      return `${remainingPercentage / columnsWithoutWidth}%`;
    } else {
      // All columns have width, distribute equally
      return `${100 / sortedColumns.length}%`;
    }
  };

  const fieldConfig = fieldConfigs.get(fieldName);

  // Container style should not interfere with table layout
  const containerStyle: React.CSSProperties = {
    ...style,
    display: "block", // Ensure table container is block, not flex
    width: "100%",
  };

  // Get label and label position from element (translate for print language)
  const labelText = t(element.label || "");
  const labelPosition = element.labelPosition || "left";

  // Render table; class used by global CSS to remove borders when showBorder is false
  const tableContent = (
    <table
      style={tableStyle}
      className={!showBorder ? "print-preview-table-no-border" : undefined}
    >
      {showHeader && (
        <thead>
          <tr>
            {sortedColumns.map((col) => {
              const columnLabelText = (col as any).label || col.field;
              const headerText = t(columnLabelText);
              return (
                <th
                  key={col.field}
                  style={{
                    ...headerCellStyle,
                    width: getColumnWidth(col),
                  }}
                >
                  {headerText}
                </th>
              );
            })}
          </tr>
        </thead>
      )}
      <tbody>
        {fieldValueArray.map((childDoc: any, rowIndex: number) => (
          <TableRow
            key={rowIndex}
            rowIndex={rowIndex}
            childDoc={childDoc}
            sortedColumns={sortedColumns}
            fieldName={fieldName}
            fieldConfig={fieldConfig}
            childFieldConfigs={childFieldConfigs}
            cellStyle={cellStyle}
            getColumnWidth={getColumnWidth}
            orgDoc={orgDoc}
            language={language}
          />
        ))}
      </tbody>
    </table>
  );

  // Wrap table with label if label text is provided
  if (labelText) {
    if (labelPosition === "top") {
      return (
        <div data-item-id={element.id} style={containerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
            <span style={{ fontSize: "0.9em", opacity: 0.7 }}>{labelText}</span>
            {tableContent}
          </div>
        </div>
      );
    } else if (labelPosition === "bottom") {
      return (
        <div data-item-id={element.id} style={containerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
            {tableContent}
            <span style={{ fontSize: "0.9em", opacity: 0.7 }}>{labelText}</span>
          </div>
        </div>
      );
    } else if (labelPosition === "left") {
      return (
        <div data-item-id={element.id} style={containerStyle}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "8px", width: "100%" }}>
            <span style={{ fontSize: "0.9em", opacity: 0.7, whiteSpace: "nowrap", paddingTop: "4px" }}>{labelText}</span>
            <div style={{ flex: 1, minWidth: 0 }}>{tableContent}</div>
          </div>
        </div>
      );
    } else if (labelPosition === "right") {
      return (
        <div data-item-id={element.id} style={containerStyle}>
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "flex-start", gap: "8px", width: "100%" }}>
            <span style={{ fontSize: "0.9em", opacity: 0.7, whiteSpace: "nowrap", paddingTop: "4px" }}>{labelText}</span>
            <div style={{ flex: 1, minWidth: 0 }}>{tableContent}</div>
          </div>
        </div>
      );
    }
  }

  // No label - return table directly
  return (
    <div data-item-id={element.id} style={containerStyle}>
      {tableContent}
    </div>
  );
}

// Component to check if a group has any visible children
function GroupVisibilityChecker({
  groupContainerStyle,
  children,
}: {
  groupContainerStyle: React.CSSProperties;
  children: React.ReactNode[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasVisibleChildren, setHasVisibleChildren] = useState(true);

  useEffect(() => {
    if (containerRef.current) {
      // Check if container has any visible content
      const container = containerRef.current;
      const hasContent =
        container.textContent?.trim() !== "" ||
        container.querySelector('img') !== null ||
        container.querySelector('table') !== null ||
        container.children.length > 0;

      setHasVisibleChildren(hasContent);
    }
  }, [children]);

  if (!hasVisibleChildren) {
    return null;
  }

  return (
    <div ref={containerRef} style={groupContainerStyle}>
      {children}
    </div>
  );
}

// Render a single template element
function TemplateElementRenderer({
  element,
  doc,
  doctype,
  allElements,
  fieldConfigs,
  childFieldConfigs,
  language,
  orgDoc,
  isFixedPosition,
}: {
  element: PrintTemplateElement;
  doc: any;
  doctype: string;
  allElements: PrintTemplateElement[];
  fieldConfigs: Map<string, { type: string; reference?: string }>;
  childFieldConfigs: Map<string, Map<string, { type: string }>>;
  language?: string;
  orgDoc?: any;
  isFixedPosition: boolean;
}) {
  const { t } = useTranslation(language);

  // Calculate position
  let actualX = element.transform?.x || 0;
  let actualY = element.transform?.y || 0;

  if (element.anchorTo) {
    const anchorPos = calculateAnchorPosition(element, allElements);
    actualX = anchorPos.x;
    actualY = anchorPos.y;
  }

  const style: React.CSSProperties = {
    boxSizing: "border-box",
    fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : undefined,
    fontWeight: element.style?.fontWeight,
    fontStyle: element.style?.fontStyle,
    textDecoration: element.style?.textDecoration,
    color: element.style?.color || "#000",
    backgroundColor: element.style?.backgroundColor,
    border: element.style?.border,
    padding: element.style?.padding,
    margin: element.style?.margin || "0",
  };

  // Check if this element belongs to a group (section)
  const belongsToGroup = !!element.group;
  const isReferenceTable = element.type === "field" && element.fields;

  if (isFixedPosition) {
    style.position = "relative";
    // Reference table elements with fixed position should use flex: 1
    if (isReferenceTable) {
      style.flex = "1";
      style.width = "100%";
    } else if (!belongsToGroup) {
      // If element belongs to a group, don't set width to 100% - let grid handle it
      style.width = "100%";
      style.flex = "1";
    } else {
      // For elements in a group, use auto width to fit grid column
      style.width = "auto";
      style.maxWidth = "100%";
    }
    if (isReferenceTable) {
      // Reference table - use min-height
      style.minHeight = `${pxToMm(element.transform?.height || 30)}mm`;
    } else {
      style.minHeight = `${pxToMm(element.transform?.height || 30)}mm`;
    }
  } else {
    // Non-fixed position: use absolute positioning (matching PDF renderer)
    style.position = "absolute";
    style.left = `${pxToMm(actualX)}mm`;
    style.top = `${pxToMm(actualY)}mm`;
    style.width = `${pxToMm(element.transform?.width || 200)}mm`;

    if (!isReferenceTable) {
      style.height = `${pxToMm(element.transform?.height || 30)}mm`;
    } else {
      style.minHeight = `${pxToMm(element.transform?.height || 30)}mm`;
    }
  }

  // Alignment
  const textAlign = element.align === "center" ? "center" : element.align === "right" ? "right" : "left";
  style.textAlign = textAlign;

  if (element.verticalAlign === "middle") {
    style.display = "flex";
    style.alignItems = "center";
  } else if (element.verticalAlign === "top") {
    style.display = "flex";
    style.alignItems = "flex-start";
  } else if (element.verticalAlign === "bottom") {
    style.display = "flex";
    style.alignItems = "flex-end";
  }

  let content: React.ReactNode = null;

  switch (element.type) {
    case "text": {
      const textValue = typeof element.value === "string" ? element.value : "";
      content = <span>{t(textValue)}</span>;
      break;
    }

    case "field": {
      const fieldName = typeof element.value === "string" ? element.value : "";
      let currentFieldValue = getFieldValue(doc, fieldName, orgDoc);

      const fieldConfig = fieldConfigs.get(fieldName);
      const isImagePreviewField = fieldConfig?.type === "Image Preview";

      // Handle Image Preview fields
      if (isImagePreviewField && currentFieldValue && !element.fields) {
        const docDoctype = (doc as any)?.doctype || "";
        const imageUrl = currentFieldValue.startsWith("http") || currentFieldValue.startsWith("data:")
          ? currentFieldValue
          : `/files/${docDoctype}/${doc.id}/${fieldName}/${currentFieldValue}`;
        content = <img src={imageUrl} alt={fieldName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />;
      } else if (element.fields && element.fields.length > 0) {
        // Reference Table - use ReferenceTableRenderer component for async data loading
        // Create a style for the table container that doesn't include flex/display properties
        const tableContainerStyle: React.CSSProperties = {
          boxSizing: "border-box",
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textDecoration: style.textDecoration,
          color: style.color,
          // Position styles for non-fixed position
          ...(isFixedPosition ? {} : {
            position: style.position,
            left: style.left,
            top: style.top,
            width: style.width,
            minHeight: style.minHeight,
          }),
        };
        return (
          <ReferenceTableRenderer
            element={element}
            doc={doc}
            doctype={doctype}
            fieldName={fieldName}
            fieldConfigs={fieldConfigs}
            childFieldConfigs={childFieldConfigs}
            language={language}
            orgDoc={orgDoc}
            style={tableContainerStyle}
            isFixedPosition={isFixedPosition}
          />
        );
      } else {
        // Regular field: translate value if field type is Select
        const displayValue = fieldConfig?.type === "Select" ? t(currentFieldValue) : currentFieldValue;

        if (element.hideNoValue && !currentFieldValue) {
          return null;
        }

        const labelText = t(element.label || "");
        const labelPosition = element.labelPosition || "left";

        if (labelText && labelPosition === "top") {
          content = (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%", height: "100%" }}>
              <span style={{ fontSize: "0.9em", opacity: 0.7 }}>{labelText}</span>
              <span>{displayValue}</span>
            </div>
          );
        } else if (labelText && labelPosition === "bottom") {
          content = (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%", height: "100%" }}>
              <span>{displayValue}</span>
              <span style={{ fontSize: "0.9em", opacity: 0.7 }}>{labelText}</span>
            </div>
          );
        } else if (labelText && labelPosition === "left") {
          content = (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", width: "100%", height: "100%" }}>
              <span style={{ fontSize: "0.9em", opacity: 0.7, whiteSpace: "nowrap" }}>{labelText}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{displayValue}</span>
            </div>
          );
        } else if (labelText && labelPosition === "right") {
          content = (
            <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: "8px", width: "100%", height: "100%" }}>
              <span style={{ fontSize: "0.9em", opacity: 0.7, whiteSpace: "nowrap" }}>{labelText}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{displayValue}</span>
            </div>
          );
        } else {
          content = <span>{displayValue}</span>;
        }
      }
      break;
    }

    case "image": {
      const imagePath = typeof element.value === "string" ? element.value : "";
      if (imagePath) {
        const imageUrl = imagePath.startsWith("http") || imagePath.startsWith("data:")
          ? imagePath
          : `/files/zodula__Print Template Item/${element.id}/image/${imagePath}`;
        content = <img src={imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />;
      }
      break;
    }

    case "line": {
      style.borderTop = "1px solid #000";
      style.height = "1px";
      content = null;
      break;
    }

    case "reference": {
      // Reference elements would need to fetch referenced documents
      // For now, just show placeholder
      content = <span>[Reference]</span>;
      break;
    }

    case "custom_html": {
      // Custom HTML would need binba template rendering
      // For now, just show placeholder
      content = <span>[Custom HTML]</span>;
      break;
    }

    case "anchor": {
      // Anchor elements are containers for groups (sections)
      // Render children that belong to this group
      const groupChildren = allElements
        .filter((el) => el.group === element.id)
        .sort((a, b) => (a.idx || 0) - (b.idx || 0)); // Sort by idx to maintain order

      if (groupChildren.length > 0) {
        // Helper function to check if a child element would be hidden
        const wouldChildBeHidden = (child: PrintTemplateElement): boolean => {
          if (child.type === "field") {
            const fieldName = typeof child.value === "string" ? child.value : "";

            // Check if this is a reference table
            if (child.fields && child.fields.length > 0) {
              // Reference table - check if it has empty array and should be hidden
              // Check both element-level hideNoValue and table-level hideNoValue
              const elementHideNoValue = child.hideNoValue === true;
              const tableHideNoValue = child.tableConfig?.hideNoValue === true;
              const hideNoValue = elementHideNoValue || tableHideNoValue;

              if (hideNoValue) {
                // Get the field value - for reference tables, it should be an array
                const fieldValue = doc[fieldName];
                const fieldValueArray = Array.isArray(fieldValue) ? fieldValue : [];
                // Empty array [] should be treated as "no value"
                if (fieldValueArray.length === 0) {
                  return true; // Hide reference table with empty array
                }
              }
              // If hideNoValue is false or array has items, don't hide
              return false;
            }

            // Regular field - check hideNoValue and field value
            if (child.hideNoValue) {
              const fieldValue = getFieldValue(doc, fieldName, orgDoc);
              return !fieldValue || (typeof fieldValue === "string" && fieldValue.trim() === "");
            }
          } else if (child.type === "text") {
            if (child.hideNoValue) {
              const textValue = typeof child.value === "string" ? child.value : "";
              return !textValue || textValue.trim() === "";
            }
          } else if (child.type === "image") {
            if (child.hideNoValue) {
              const imagePath = typeof child.value === "string" ? child.value : "";
              return !imagePath;
            }
          }

          return false; // Element is not hidden
        };

        // Check all children (including reference tables) to see if they should be hidden
        const hiddenChildren = groupChildren.filter(wouldChildBeHidden);

        // If all children are hidden (including reference tables with empty arrays), hide the group
        if (hiddenChildren.length === groupChildren.length) {
          return null; // All children are hidden - hide the group
        }

        // Render all children - those that should be hidden will return null
        const renderedChildren = groupChildren.map((child) => (
          <TemplateElementRenderer
            key={child.id}
            element={child}
            doc={doc}
            doctype={doctype}
            allElements={allElements}
            fieldConfigs={fieldConfigs}
            childFieldConfigs={childFieldConfigs}
            language={language}
            orgDoc={orgDoc}
            isFixedPosition={isFixedPosition}
          />
        ));

        // Use a wrapper component to track which children are actually rendered (not null)
        // We'll use a state to track visible children count
        const GroupChildrenWrapper = () => {
          const [visibleCount, setVisibleCount] = useState(0);
          const childRefs = useRef<(boolean | null)[]>([]);

          useEffect(() => {
            // Count non-null children by checking if they render content
            // This is a workaround - we'll use a different approach
          }, [renderedChildren]);

          return (
            <>
              {renderedChildren.map((child, index) => {
                // We can't easily check if a React element will render null
                // So we'll render all and filter in a different way
                return child;
              })}
            </>
          );
        };

        // Simpler approach: render all children and use CSS to hide empty groups
        // But we need to actually check if they're null...
        // Actually, the best approach is to render them and check the DOM, but that's not ideal

        // Better approach: Create a component that tracks visibility
        const GroupContent = () => {
          const [hasVisibleChildren, setHasVisibleChildren] = useState(true);
          const containerRef = useRef<HTMLDivElement>(null);

          useEffect(() => {
            // Check if container has any visible children
            if (containerRef.current) {
              const hasChildren = containerRef.current.children.length > 0;
              // Check if any child has content (not just empty divs)
              const hasContent = Array.from(containerRef.current.children).some((child) => {
                return child.textContent?.trim() || child.querySelector('img, table');
              });
              setHasVisibleChildren(hasContent);
            }
          }, [renderedChildren]);

          if (!hasVisibleChildren) {
            return null;
          }

          return (
            <div ref={containerRef}>
              {renderedChildren}
            </div>
          );
        };

        // Actually, the simplest approach: render children and let TemplateElementRenderer
        // return null for hidden elements. Then we check if we have any visible children
        // by using a ref callback or by checking after render.

        // Even simpler: Just render all children. If TemplateElementRenderer returns null,
        // React won't render it. Then we can use a container div and check its children.
        // But we need to know before rendering the group container...

        // Best approach: Use a state to track if any children are visible
        // We'll create a wrapper that checks children visibility

        // Get number of columns for this group (default to 1 if not specified)
        const columns = element.columns || 1;

        // Group container should have proper styling
        const groupContainerStyle: React.CSSProperties = {
          boxSizing: "border-box",
          position: "relative",
          width: "100%",
          ...(isFixedPosition ? {
            // Fixed position: use CSS Grid for multi-column layout
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "8px", // Gap between grid items
            alignItems: "start", // Align items to start
          } : {
            // Non-fixed position: use absolute positioning
            position: "absolute",
            left: `${pxToMm(actualX)}mm`,
            top: `${pxToMm(actualY)}mm`,
            width: `${pxToMm(element.transform?.width || 200)}mm`,
            minHeight: `${pxToMm(element.transform?.height || 30)}mm`,
          }),
        };

        // Render all children - TemplateElementRenderer will return null for hidden elements
        // We'll use a wrapper component to check if any children are visible after render
        content = (
          <GroupVisibilityChecker
            groupContainerStyle={groupContainerStyle}
            children={renderedChildren}
          />
        );
      } else {
        // Group has no children - hide it if hideNoValue is set
        if (element.hideNoValue) {
          return null;
        }
      }
      break;
    }
  }

  // Don't render if content is null and element should be hidden
  if (!content && element.hideNoValue) {
    return null;
  }

  return (
    <div data-item-id={element.id} style={style}>
      {content}
    </div>
  );
}

// Table row component
function TableRow({
  rowIndex,
  childDoc,
  sortedColumns,
  fieldName,
  fieldConfig,
  childFieldConfigs,
  cellStyle,
  getColumnWidth,
  orgDoc,
  language,
}: {
  rowIndex: number;
  childDoc: any;
  sortedColumns: Array<{ field: string; label?: string; order?: number; width?: number }>;
  fieldName: string;
  fieldConfig?: { type: string; reference?: string };
  childFieldConfigs: Map<string, Map<string, { type: string }>>;
  cellStyle: React.CSSProperties;
  getColumnWidth: (col: any) => string;
  orgDoc?: any;
  language?: string;
}) {
  const { t } = useTranslation(language);
  const childFieldConfigsForParent = childFieldConfigs.get(fieldName);

  return (
    <tr
      style={{
        boxSizing: "border-box",
      }}
    >
      {sortedColumns.map((col) => {
        const childValue = getFieldValue(childDoc, col.field, orgDoc);
        const childFieldConfig = childFieldConfigsForParent?.get(col.field);
        const isImagePreviewChild = childFieldConfig?.type === "Image Preview";
        const isSelectChild = childFieldConfig?.type === "Select";

        let cellContent: React.ReactNode = isSelectChild ? t(childValue) : childValue;
        if (isImagePreviewChild && childValue) {
          const imageUrl = childValue.startsWith("http") || childValue.startsWith("data:")
            ? childValue
            : `/files/${fieldConfig?.reference}/${childDoc.id}/${col.field}/${childValue}`;
          cellContent = (
            <img
              src={imageUrl}
              alt={col.field}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          );
        }

        return (
          <td
            key={col.field}
            style={{
              ...cellStyle,
              width: getColumnWidth(col),
            }}
          >
            {cellContent}
          </td>
        );
      })}
    </tr>
  );
}

export function PrintPreviewRenderer({
  doctype,
  docIds,
  printTemplateId,
  letterHeadId,
  language = "en",
  org,
  targetRef,
}: PrintPreviewRendererProps) {
  const [elements, setElements] = useState<PrintTemplateElement[]>([]);
  const [templateConfig, setTemplateConfig] = useState<any>(null);
  const [letterHeadElements, setLetterHeadElements] = useState<PrintTemplateElement[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<Map<string, { type: string; reference?: string }>>(new Map());
  const [childFieldConfigs, setChildFieldConfigs] = useState<Map<string, Map<string, { type: string }>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [orgDoc, setOrgDoc] = useState<any>(null);

  // Fetch organization document if org is provided
  const { doc: organizationDoc } = useDoc({
    doctype: "zodula__Organization",
    id: org || "",
  }, [org]);

  useEffect(() => {
    setOrgDoc(organizationDoc);
  }, [organizationDoc]);

  // Fetch documents
  const { docs: documents } = useDocList({
    doctype: doctype as Zodula.DoctypeName,
    limit: docIds.length || 100,
    filters: docIds.length > 0 ? [["id", "IN", docIds]] : [],
  }, [doctype, docIds]);

  // Fetch print template - use async function to handle errors properly
  const [printTemplate, setPrintTemplate] = useState<any>(null);
  const [printTemplateLoading, setPrintTemplateLoading] = useState(false);
  const [printTemplateError, setPrintTemplateError] = useState<string | null>(null);

  // Fetch letter head - use async function to handle errors properly
  const [letterHead, setLetterHead] = useState<any>(null);
  const [letterHeadLoading, setLetterHeadLoading] = useState(false);
  const [letterHeadError, setLetterHeadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrintTemplate() {
      if (!printTemplateId) {
        setPrintTemplate(null);
        setPrintTemplateLoading(false);
        setPrintTemplateError(null);
        return;
      }

      setPrintTemplateLoading(true);
      setPrintTemplateError(null);
      try {
        const { zodula } = await import("@/zodula/client");
        const result = await zodula?.doc?.get_doc("zodula__Print Template", printTemplateId, {
          fields: ["*", "items", "fixed_position_items", "guided_background", "organization"],
        });
        setPrintTemplate(result || null);
        setPrintTemplateError(null);
      } catch (e: any) {
        setPrintTemplateError(e?.message || "Failed to load print template");
        setPrintTemplate(null);
      } finally {
        setPrintTemplateLoading(false);
      }
    }

    fetchPrintTemplate();
  }, [printTemplateId]);

  useEffect(() => {
    async function fetchLetterHead() {
      if (!letterHeadId) {
        setLetterHead(null);
        setLetterHeadLoading(false);
        setLetterHeadError(null);
        return;
      }

      setLetterHeadLoading(true);
      setLetterHeadError(null);
      try {
        const { zodula } = await import("@/zodula/client");
        const result = await zodula?.doc?.get_doc("zodula__Letter Head", letterHeadId);
        setLetterHead(result || null);
        setLetterHeadError(null);
      } catch (e: any) {
        setLetterHeadError(e?.message || "Failed to load letter head");
        setLetterHead(null);
      } finally {
        setLetterHeadLoading(false);
      }
    }

    fetchLetterHead();
  }, [letterHeadId]);

  // Fetch all fields
  const { docs: allFields } = useDocListAll({
    doctype: "zodula__Field",
  });

  // Fetch doctype
  const { doc: doctypeDoc } = useDoc({
    doctype: "zodula__Doctype",
    id: doctype,
  }, [doctype]);

  // Build field configs
  useEffect(() => {
    const configs = new Map<string, { type: string; reference?: string }>();
    const childConfigs = new Map<string, Map<string, { type: string }>>();

    allFields.forEach((field: any) => {
      if (field.doctype === doctype) {
        configs.set(field.name, {
          type: field.type || "",
          reference: field.reference || undefined,
        });
      }
    });

    // Build child field configs for Reference Tables
    elements.forEach((element) => {
      if (element.type === "field" && element.fields && element.fields.length > 0) {
        const fieldName = typeof element.value === "string" ? element.value : "";
        const parentFieldConfig = configs.get(fieldName);
        const referenceDoctype = parentFieldConfig?.reference;

        if (referenceDoctype) {
          const childConfigsForParent = new Map<string, { type: string }>();
          allFields.forEach((field: any) => {
            if (field.doctype === referenceDoctype) {
              childConfigsForParent.set(field.name, { type: field.type || "" });
            }
          });
          childConfigs.set(fieldName, childConfigsForParent);
        }
      }
    });

    setFieldConfigs(configs);
    setChildFieldConfigs(childConfigs);
  }, [allFields, doctype, elements]);

  // Load template items or generate default
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true);

      try {
        let shouldUseDefault = false;

        // If printTemplateId is provided, wait for it to load (or fail)
        if (printTemplateId) {
          // If still loading, wait a bit and check again (this will be handled by useEffect re-running)
          if (printTemplateLoading) {
            setLoading(false);
            return; // Wait for template to load
          }

          // Template finished loading - check if it exists
          if (printTemplate) {
            // Load from template
            const isFixedPosition = (printTemplate as any).is_fixed_position === 1 || (printTemplate as any).is_fixed_position === true;

            // When NOT fixed position use Print Template.items; when fixed position use fixed_position_items
            const itemsFieldName = isFixedPosition ? "fixed_position_items" : "items";

            let templateItems: any[] = [];

            // Try Approach 1: Use relationship from get_doc (correct field: items vs fixed_position_items)
            if ((printTemplate as any)[itemsFieldName]) {
              try {
                const itemsFromRelationship = (printTemplate as any)[itemsFieldName];
                if (Array.isArray(itemsFromRelationship)) {
                  templateItems = itemsFromRelationship;
                  templateItems.sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0));
                }
              } catch {
                // Relationship not available; templateItems stays []
              }
            }

            // Try Approach 2: Direct query by parentid + parentfield (only the correct table)
            if (templateItems.length === 0) {
              try {
                const result = await zodula?.doc?.select_docs("zodula__Print Template Item", {
                  limit: 1000,
                  filters: [
                    ["parentid" as any, "=", printTemplateId],
                    ["parentfield" as any, "=", itemsFieldName],
                  ],
                  sort: "idx",
                  order: "asc",
                }) || { docs: [] };
                templateItems = result.docs || [];
              } catch {
                // Direct query failed; templateItems stays []
              }
            }

            // Use only the correct field (items or fixed_position_items). If empty, render empty - no fallback.
            if (templateItems.length === 0) {
              // Correct field is empty: render empty (apply template format/margins but no elements)
              setElements([]);
              setTemplateConfig({
                format: printTemplate.format || "A4",
                customWidth: printTemplate.custom_width,
                customHeight: printTemplate.custom_height,
                marginTop: printTemplate.margin_top || 0,
                marginRight: printTemplate.margin_right || 0,
                marginBottom: printTemplate.margin_bottom || 0,
                marginLeft: printTemplate.margin_left || 0,
                css: printTemplate.css || "",
                isFixedPosition,
              });
            } else {
              const convertedElements = templateItems.map((item: any) => itemToElement(item));
              setElements(convertedElements);
              setTemplateConfig({
                format: printTemplate.format || "A4",
                customWidth: printTemplate.custom_width,
                customHeight: printTemplate.custom_height,
                marginTop: printTemplate.margin_top || 0, 
                marginRight: printTemplate.margin_right || 0,
                marginBottom: printTemplate.margin_bottom || 0,
                marginLeft: printTemplate.margin_left || 0,
                css: printTemplate.css || "",
                isFixedPosition,
              });
            }
          } else {
            // printTemplateId was provided but template not found - use default
            shouldUseDefault = true;
          }
        } else {
          // No template selected, use default
          shouldUseDefault = true;
        }

        // Generate default template if needed
        if (shouldUseDefault) {
          if (doctypeDoc && doctype) {
            // Generate default template (with or without tabs - generateFixedPositionTemplateFromTabs handles null/empty tabs)
            const tabs = typeof doctypeDoc.tabs === "string" ? JSON.parse(doctypeDoc.tabs) : doctypeDoc.tabs;
            const tabsArray = Array.isArray(tabs) && tabs.length > 0 ? tabs : null;

            const fields = allFields
              .filter((f: any) => f.doctype === doctype)
              .map((f: any) => ({
                name: f.name || "",
                label: f.label || f.name || "",
                type: f.type || "",
                reference: f.reference || undefined,
                no_print: f.no_print === 1 || f.no_print === true,
              }));

            const fetchChildFields = async (referenceDoctype: string, parentDoctype?: string): Promise<any[]> => {
              const { docs: childFieldDocs } = await zodula?.doc?.select_docs("zodula__Field", {
                limit: 1000,
                filters: [["doctype", "=", referenceDoctype]],
                sort: "idx",
                order: "asc",
              }) || { docs: [] };

              const standardFieldNames = new Set([
                "id", "organization", "organization_abbr", "owner", "created_at", "updated_at",
                "created_by", "updated_by", "doc_status", "idx", "vector"
              ]);

              return childFieldDocs
                .filter((field: any) => {
                  const fieldDoctype = field.doctype || "";
                  const fieldName = field.name || "";
                  const fieldReference = field.reference || "";
                  const fieldNoPrint = field.no_print === 1 || field.no_print === true;
                  const isParentReference = parentDoctype && fieldReference === parentDoctype;
                  return fieldDoctype === referenceDoctype && !standardFieldNames.has(fieldName) && !isParentReference && !fieldNoPrint;
                })
                .map((field: any, idx: number) => ({
                  field: field.name || "",
                  label: field.label || field.name || "",
                  order: idx,
                  required: field.required === 1 || field.required === true,
                  in_list_view: field.in_list_view === 1 || field.in_list_view === true,
                  no_print: field.no_print === 1 || field.no_print === true,
                }))
                .filter((col: any) => col.field);
            };

            const generatedElements = await generateFixedPositionTemplateFromTabs({
              tabs: tabsArray ?? undefined,
              fields,
              pageDimensions: PAGE_FORMATS.A4 || { width: 210, height: 297 },
              doctypeLabel: doctypeDoc.label || doctype,
              fetchChildFields,
              doctype,
            });

            setElements(generatedElements);
            setTemplateConfig({
              format: "A4",
              marginTop: 10,
              marginRight: 10,
              marginBottom: 10,
              marginLeft: 10,
              css: "",
              isFixedPosition: true,
            });
          } else {
            // Doctype not loaded yet, wait for it
            // Elements will be set when doctypeDoc is available
            setElements([]);
            setTemplateConfig({
              format: "A4",
              marginTop: 10,
              marginRight: 10,
              marginBottom: 10,
              marginLeft: 10,
              css: "",
              isFixedPosition: true,
            });
          }
        }

        // Load letter head items
        if (letterHeadId && letterHead) {
          const { docs: letterHeadItems } = await zodula?.doc?.select_docs("zodula__Letter Head Item", {
            limit: 1000,
            filters: [["letter_head", "=", letterHeadId]],
            sort: "idx",
            order: "asc",
          }) || { docs: [] };

          const convertedLetterHeadElements = letterHeadItems.map((item: any) => itemToElement(item));
          setLetterHeadElements(convertedLetterHeadElements);
        }
      } catch {
        // Template load failed; loading state cleared in finally
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [printTemplateId, printTemplate, printTemplateLoading, doctypeDoc, doctype, letterHeadId, letterHead, allFields]);

  const pageDims = useMemo(() => {
    if (!templateConfig) return PAGE_FORMATS.A4 || { width: 210, height: 297 };
    if (templateConfig.format === "Custom") {
      return { width: templateConfig.customWidth || 210, height: templateConfig.customHeight || 297 };
    }
    return PAGE_FORMATS[templateConfig.format] || PAGE_FORMATS.A4 || { width: 210, height: 297 };
  }, [templateConfig]);

  // Show errors if any - show them before loading completes
  if (printTemplateError) {
    return <div className="zd:p-4 zd:text-red-500">Error loading print template: {printTemplateError}</div>;
  }

  if (letterHeadError) {
    return <div className="zd:p-4 zd:text-red-500">Error loading letter head: {letterHeadError}</div>;
  }

  if (loading || printTemplateLoading || letterHeadLoading || documents.length === 0) {
    return <div>Loading...</div>;
  }

  const isFixedPosition = templateConfig?.isFixedPosition || false;

  // Use mm so preview margins match PDF (PDF uses mm; plain numbers would be px and look smaller)
  const marginTop = templateConfig?.marginTop ?? 0;
  const marginRight = templateConfig?.marginRight ?? 0;
  const marginBottom = templateConfig?.marginBottom ?? 0;
  const marginLeft = templateConfig?.marginLeft ?? 0;

  // Guided background URL from print template (show in preview only; hidden in PDF via .pdf-export-isolate)
  const organization = (printTemplate as any)?.organization ?? org ?? "";
  const rawGuidedBg =
    (printTemplate as any)?.guided_background ?? (printTemplate as any)?.guidedBackground;
  const guidedBackgroundFilename =
    typeof rawGuidedBg === "string"
      ? rawGuidedBg.trim()
      : rawGuidedBg && typeof rawGuidedBg === "object"
        ? (rawGuidedBg.path ?? rawGuidedBg.name ?? rawGuidedBg.filename ?? "").trim()
        : "";
  const hasGuidedBackground = guidedBackgroundFilename !== "" && printTemplateId;
  const guidedBackgroundUrl =
    hasGuidedBackground && organization
      ? `${BASE_URL}/files/${organization}/zodula__Print Template/${printTemplateId}/guided_background/${guidedBackgroundFilename}`
      : null;
  const guidedBackgroundUrlEncoded = guidedBackgroundUrl ? encodeURI(guidedBackgroundUrl) : null;

  const pageContentHeightMm = pageDims.height - marginTop - marginBottom;

  return (
    <div
      className="print-preview-pages-wrapper"
      style={{
        backgroundColor: "#e5e7eb",
        width: "fit-content",
        margin: "0 auto",
        padding: "16px",
      }}
    >
      <div
        ref={targetRef}
        className="print-preview-container"
        style={{
          width: `${pageDims.width}mm`,
          maxWidth: `${pageDims.width}mm`,
          minHeight: `${pageDims.height}mm`,
          margin: "0 auto",
          backgroundColor: "#e5e7eb",
          position: "relative",
          boxSizing: "border-box",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          fontSize: "14px",
          color: "#1f2937",
          lineHeight: "1.5",
          padding: "0",
          border: "none",
          outline: "none",
          overflow: "visible",
          ["--page-content-height-mm" as string]: pageContentHeightMm,
          ["--page-height-mm" as string]: pageDims.height,
          ["--page-margin-top-mm" as string]: marginTop,
          ["--page-margin-right-mm" as string]: marginRight,
          ["--page-margin-bottom-mm" as string]: marginBottom,
          ["--page-margin-left-mm" as string]: marginLeft,
        }}
      >
        <style>{`
        /* CSS Reset for print preview - isolate from website styles */
        .print-preview-container,
        .print-preview-container * {
          box-sizing: border-box;
        }
        .print-preview-container {
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 14px !important;
          color: #1f2937 !important;
          line-height: 1.5 !important;
          margin: 0 auto !important;
          padding: 0 !important;
          border: none !important;
          outline: none !important;
          width: ${pageDims.width}mm !important;
          max-width: ${pageDims.width}mm !important;
          min-width: ${pageDims.width}mm !important;
        }
        .print-preview-container .page-container {
          position: relative !important;
          width: ${pageDims.width}mm !important;
          max-width: ${pageDims.width}mm !important;
          min-width: ${pageDims.width}mm !important;
          min-height: ${pageDims.height}mm !important;
          margin: 0 !important;
          margin-bottom: 20mm !important;
          padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
          background-color: #ffffff !important;
          overflow: visible !important;
          box-sizing: border-box !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
        }
        .print-preview-container .page-container:last-child {
          margin-bottom: 0 !important;
        }
        .print-preview-container table {
          display: table !important;
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          box-sizing: border-box !important;
          background-color: transparent !important;
        }
        .print-preview-container table thead,
        .print-preview-container table tbody,
        .print-preview-container table tr {
          background-color: transparent !important;
        }
        .print-preview-container table thead {
          display: table-header-group !important;
        }
        .print-preview-container table tbody {
          display: table-row-group !important;
        }
        .print-preview-container table tr {
          display: table-row !important;
        }
        .print-preview-container table th,
        .print-preview-container table td {
          display: table-cell !important;
          box-sizing: border-box !important;
          border: 1px solid #e5e7eb !important;
          padding: 0 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: top;
          line-height: 1;
          background-color: transparent !important;
        }
        /* Table with showBorder: false - no borders (tableConfig from template) */
        .print-preview-container table.print-preview-table-no-border,
        .print-preview-container table.print-preview-table-no-border th,
        .print-preview-container table.print-preview-table-no-border td {
          border: none !important;
        }
        .print-preview-container table thead th {
          font-weight: 600 !important;
          color: #1f2937 !important;
          background-color: transparent !important;
        }
        /* Ensure groups and all elements have proper box-sizing */
        .print-preview-container [data-item-id] {
          box-sizing: border-box !important;
        }
        /* Reset only base styles, preserve inline styles */
        .print-preview-container > * {
          margin: 0;
        }
        /* Page break: new page when printing/PDF (rgb/hex for html2canvas) */
        .print-preview-container .page-break,
        .print-preview-container .page-break-before {
          page-break-before: always;
          break-before: page;
          display: block;
          height: 0;
          margin: 0;
          padding: 0;
          border: none;
          overflow: hidden;
        }
        .print-preview-container .page-break-after {
          page-break-after: always;
          break-after: page;
          display: block;
          height: 0;
          margin: 0;
          padding: 0;
          border: none;
          overflow: hidden;
        }
        .print-preview-container .page-break--visible {
          height: 0;
          margin: 16px 0;
          padding: 0;
          border: none;
          border-top: 2px dashed #e5e7eb;
          overflow: visible;
          visibility: visible;
          page-break-before: always;
          break-before: page;
        }
        /* Preview only: show dashed line at page break (hidden in PDF via .pdf-export-isolate) */
        .print-preview-container .page-break--preview-visible {
          margin: 16px 0;
          border-top: 2px dashed #e5e7eb;
          overflow: visible;
        }
        ${templateConfig?.css || ""}
        ${(letterHead as any)?.css_content || ""}
      `}</style>

        {/* Render each document in its own page; page-break forces new page when printing/PDF */}
        {documents.map((doc, docIndex) => (
          <React.Fragment key={doc.id || docIndex}>
            {docIndex > 0 && (
              <div
                className="page-break page-break-before page-break--preview-visible"
                style={{ padding: 0, height: 0 }}
                aria-hidden
              />
            )}
            <div
              className="page-container"
              style={{
                position: "relative",
                minHeight: `${pageContentHeightMm}mm`,
              }}
            >
              {/* Guided background (from print template; visible in preview, hidden in PDF via .pdf-export-isolate) */}
              {guidedBackgroundUrlEncoded && (
                <div
                  className="guided-background-preview"
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 0,
                    pointerEvents: "none",
                    backgroundImage: `url("${guidedBackgroundUrlEncoded}")`,
                    backgroundSize: "100% auto",
                    backgroundPosition: "top left",
                    backgroundRepeat: "no-repeat",
                    opacity: 0.35,
                  }}
                />
              )}
              {/* Content above guided background: letter head on top, then print template below (no overlap) */}
              <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
                {/* Letter Head - reserve height so template content starts below */}
                {letterHeadElements.length > 0 && (
                  <div style={{
                    textAlign: (letterHead as any)?.align === "center" ? "center" : (letterHead as any)?.align === "right" ? "right" : "left",
                    position: "relative",
                    width: "100%",
                    minHeight: `${pxToMm(getLetterHeadHeightPx(letterHeadElements)) + 3}mm`,
                    flexShrink: 0,
                  }}>
                    {letterHeadElements.map((element) => (
                      <TemplateElementRenderer
                        key={element.id}
                        element={element}
                        doc={doc}
                        doctype={doctype}
                        allElements={letterHeadElements}
                        fieldConfigs={fieldConfigs}
                        childFieldConfigs={childFieldConfigs}
                        language={language}
                        orgDoc={orgDoc}
                        isFixedPosition={false}
                      />
                    ))}
                  </div>
                )}

                {/* Template Items - below letter head */}
                {isFixedPosition ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  position: "relative",
                  width: "100%",
                  marginTop: letterHeadElements.length > 0 ? "3mm" : 0,
                  flex: 1,
                }}>
                  {elements
                    .filter((el) => !el.group) // Only show top-level elements (groups and standalone)
                    .sort((a, b) => (a.idx || 0) - (b.idx || 0))
                    .map((element) => (
                      <TemplateElementRenderer
                        key={element.id}
                        element={element}
                        doc={doc}
                        doctype={doctype}
                        allElements={elements}
                        fieldConfigs={fieldConfigs}
                        childFieldConfigs={childFieldConfigs}
                        language={language}
                        orgDoc={orgDoc}
                        isFixedPosition={true}
                      />
                    ))}
                </div>
              ) : (
                <div style={{
                  position: "relative",
                  width: "100%",
                  minHeight: `${pageDims.height - (templateConfig?.marginTop || 10) - (templateConfig?.marginBottom || 10)}mm`,
                  marginTop: letterHeadElements.length > 0 ? "3mm" : 0,
                }}>
                  {elements
                    .filter((el) => !el.group) // Only show top-level elements
                    .map((element) => (
                      <TemplateElementRenderer
                        key={element.id}
                        element={element}
                        doc={doc}
                        doctype={doctype}
                        allElements={elements}
                        fieldConfigs={fieldConfigs}
                        childFieldConfigs={childFieldConfigs}
                        language={language}
                        orgDoc={orgDoc}
                        isFixedPosition={false}
                      />
                    ))}
                </div>
              )}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

