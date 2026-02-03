import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { FormControl } from "../ui/form-control";
import { Textarea } from "../ui/textarea";
import { Tabs } from "../ui/tabs";
import { Checkbox } from "../ui/checkbox";
import { PrintTemplateElementHover } from "./print-template-element-hover";
import { cn } from "../../lib/utils";
import { BASE_URL } from "@/zodula/client/utils";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { PAGE_FORMATS, generateTemplateFromTabs as generateTemplateFromTabsUtil, type PrintTemplateElement as SharedPrintTemplateElement } from "@/zodula/client/code-utils";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { useDnd } from "@/zodula/ui/hooks/use-dnd";
import { confirm } from "../ui/popit";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { 
  Hash, Type, Image, Minus, Grid3x3, LayoutGrid, 
  GripVertical, X, Maximize2, ZoomIn, ZoomOut,
  AlignLeft, AlignCenter, AlignRight, Eye, Undo, Redo,
  ArrowUp, ArrowDown, Code, Settings, ChevronRight, ChevronLeft,
  Bold, Italic, Underline, Strikethrough,
  Wand2,
  Anchor
} from "lucide-react";

export interface PrintTemplateElement {
  id: string;
  code?: string; // Code for anchoring (stable identifier, not auto-generated id)
  type: "field" | "text" | "image" | "line" | "reference" | "custom_html" | "anchor";
  value?: string | File;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fields?: string[]; // For Reference Table and Extend: child fields to display
  // For reference element type
  referenceDoctype?: string; // Doctype to fetch from (e.g., "zodula__Organization")
  referenceIdFilter?: string; // ID filter expression (e.g., "{{session.organization}}")
  referenceField?: string; // Field to fetch (e.g., "name")
  // Label support for field and reference
  label?: string; // Label text to display
  labelPosition?: "left" | "right" | "top" | "bottom"; // Position of label relative to value
  // Anchor support - element can be anchored to another element
  anchorTo?: string; // Code of element to anchor to (not id, as id is auto-generated)
  anchorPosition?: "top-left"; // Position relative to anchored element (only top-left supported)
  anchorOffset?: number | { x: number; y: number }; // Offset in pixels from anchor position (supports both number and {x, y})
  // Table configuration for Reference Table fields
  tableConfig?: {
    columns?: Array<{
      field: string;
      width?: number; // Column width in pixels or percentage
      order?: number; // Display order
    }>;
    rowHeight?: number; // Row height in pixels
    showHeader?: boolean; // Show/hide table header
    showBorder?: boolean; // Show/hide table borders
  };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    color?: string;
    backgroundColor?: string;
    border?: string;
    padding?: string;
    margin?: string;
    width?: string;
    height?: string;
  };
  transform?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface PrintTemplateBuilderProps {
  layout: PrintTemplateElement[];
  onChange: (layout: PrintTemplateElement[]) => void;
  doctype?: string;
  fields?: Zodula.Field[];
  readonly?: boolean;
  onPreview?: () => void;
  format?: "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid" | "Custom";
  customWidth?: number; // in mm
  customHeight?: number; // in mm
  guidedBackground?: string | File; // Guided background image URL or File
  onGuidedBackgroundChange?: (background: string | File | null) => void; // Callback when guided background changes
  templateId?: string; // Template ID for file uploads
}

const TOOLS = [
  { type: "field", icon: Hash, label: "Field" },
  { type: "text", icon: Type, label: "Text" },
  { type: "image", icon: Image, label: "Image" },
  { type: "line", icon: Minus, label: "Line" },
  { type: "reference", icon: Hash, label: "Reference" },
  { type: "custom_html", icon: LayoutGrid, label: "Custom HTML" },
  { type: "anchor", icon: Grid3x3, label: "Anchor" },
] as const;

// Re-export PAGE_FORMATS for backward compatibility (now imported from code-utils)

// Table Customization Panel Component
function TableCustomizationPanel({
  element,
  id,
  childFields,
  handleUpdateElement,
  t,
  selectedFieldConfig,
  activeTab,
  onTabChange,
}: {
  element: PrintTemplateElement;
  id: string;
  childFields: Zodula.SelectDoctype<"zodula__Field">[];
  handleUpdateElement: (id: string, updates: Partial<PrintTemplateElement>) => void;
  t: (key: string) => string;
  selectedFieldConfig?: Zodula.Field | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const [configuringField, setConfiguringField] = useState<string | null>(null);
  const tabs = [
    { id: "general", label: t("General") },
    { id: "columns", label: t("Columns") }
  ];

  // Get current columns with order
  const currentColumns = useMemo(() => {
    return (element.tableConfig?.columns || (element.fields || []).map((f, idx) => ({ field: f, order: idx })))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [element.tableConfig?.columns, element.fields]);

  // Create workspace items for drag and drop
  const workspaceItems = useMemo(() => {
    return currentColumns.map((col, index) => ({
      id: col.field,
      type: 'table-column',
      idx: index * 10,
      value: col.field,
      workspaceId: 'table-columns', // Dummy workspace ID for drag and drop
    }));
  }, [currentColumns]);

  // Handle reorder
  const handleReorder = useCallback((fromId: string, toId: string, type: 'before' | 'after') => {
    const fromIndex = currentColumns.findIndex(c => c.field === fromId);
    const toIndex = currentColumns.findIndex(c => c.field === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;

    const newColumns = [...currentColumns];
    const [movedItem] = newColumns.splice(fromIndex, 1);
    
    if (!movedItem) return;

    const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    const insertIndex = type === "before" ? adjustedToIndex : adjustedToIndex + 1;
    
    newColumns.splice(insertIndex, 0, movedItem);
    
    // Update order values
    const updatedColumns = newColumns.map((col, idx) => ({
      ...col,
      order: idx
    }));

    handleUpdateElement(id, {
      tableConfig: {
        ...(element.tableConfig || { showHeader: true, showBorder: true, rowHeight: 20 }),
        columns: updatedColumns
      }
    });
  }, [currentColumns, element.tableConfig, handleUpdateElement, id]);

  // Initialize drag and drop
  const { getDragProps, getDropZoneProps } = useDnd({
    items: workspaceItems,
    onReorder: handleReorder,
    disabled: false
  });

  // Handle field configuration
  const handleFieldConfig = useCallback((fieldName: string, width?: number) => {
    const baseColumns = element.tableConfig?.columns || (element.fields || []).map((f, i) => ({ field: f, order: i }));
    const columns = [...baseColumns];
    const currentCol = columns.find(c => c.field === fieldName);
    if (currentCol) {
      (currentCol as any).width = width;
    }
    handleUpdateElement(id, {
      tableConfig: {
        ...(element.tableConfig || { showHeader: true, showBorder: true, rowHeight: 20 }),
        columns
      }
    });
    setConfiguringField(null);
  }, [element.tableConfig, element.fields, handleUpdateElement, id]);

  return (
    <div className="zd:space-y-2">
      {/* Tab Content */}
      <div>
        {activeTab === "general" && (
          <div className="zd:space-y-4 zd:px-2">
            {/* Show Header Toggle */}
            <Checkbox
              checked={element.tableConfig?.showHeader !== false}
              onCheckedChange={(checked) => {
                handleUpdateElement(id, {
                  tableConfig: {
                    ...(element.tableConfig || { columns: [], showBorder: true, rowHeight: 20 }),
                    showHeader: checked !== false
                  }
                });
              }}
              label={t("Show Header")}
              description={t("Display table header row")}
            />
            
            {/* Show Border Toggle */}
            <Checkbox
              checked={element.tableConfig?.showBorder !== false}
              onCheckedChange={(checked) => {
                handleUpdateElement(id, {
                  tableConfig: {
                    ...(element.tableConfig || { columns: [], showHeader: true, rowHeight: 20 }),
                    showBorder: checked !== false
                  }
                });
              }}
              label={t("Show Border")}
              description={t("Display table borders")}
            />
            
            {/* Row Height */}
            <div className="zd:space-y-2">
              <label className="zd:text-sm zd:font-medium">{t("Row Height")}</label>
              <div className="zd:flex zd:items-center zd:gap-2">
                <Input
                  type="number"
                  value={element.tableConfig?.rowHeight || 20}
                  onChange={(e) => {
                    handleUpdateElement(id, {
                      tableConfig: {
                        ...(element.tableConfig || { columns: [], showHeader: true, showBorder: true }),
                        rowHeight: Number(e.target.value) || 20
                      }
                    });
                  }}
                  min="10"
                  className="zd:flex-1"
                />
                <span className="zd:text-xs zd:text-muted-foreground">px</span>
              </div>
              <span className="zd:text-xs zd:text-muted-foreground">{t("Height of each table row in pixels")}</span>
            </div>
          </div>
        )}
        
        {activeTab === "columns" && (
          <div className="zd:space-y-3 zd:px-2">
            {/* Child Fields Selection */}
            {selectedFieldConfig && (selectedFieldConfig.type === "Reference Table" || selectedFieldConfig.type === "Extend") && childFields && (
              <div className="zd:space-y-2 zd:pb-4 zd:border-b zd:border-border">
                <label className="zd:text-sm zd:font-medium">{t("Child Fields")}</label>
                <div className="zd:max-h-48 zd:overflow-y-auto zd:border zd:border-border zd:rounded zd:p-2 zd:space-y-1">
                  {childFields.map((field: Zodula.SelectDoctype<"zodula__Field">) => (
                    <Checkbox
                      key={field.id}
                      checked={element.fields?.includes(field.name || "") || false}
                      onCheckedChange={(checked) => {
                        const currentFields = element.fields || [];
                        const newFields = checked
                          ? [...currentFields, field.name || ""]
                          : currentFields.filter((f) => f !== field.name);
                        // Initialize table config when fields change (only for Reference Table)
                        if (selectedFieldConfig.type === "Reference Table") {
                          const tableConfig = element.tableConfig || { columns: [], showHeader: true, showBorder: true, rowHeight: 20 };
                          const newColumns = newFields.map((f, idx) => {
                            const existing = tableConfig.columns?.find(c => c.field === f);
                            return existing || { field: f, order: idx, width: undefined };
                          });
                          handleUpdateElement(id, { 
                            fields: newFields,
                            tableConfig: { ...tableConfig, columns: newColumns }
                          });
                        } else {
                          handleUpdateElement(id, { fields: newFields });
                        }
                      }}
                      label={field.label || field.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Column List with Drag and Drop */}
            {currentColumns.length > 0 && (
              <div className="zd:space-y-2 zd:max-h-[400px] zd:overflow-y-auto zd:pr-1">
                {currentColumns.map((col, idx) => {
                  const field = childFields.find((f: any) => f.name === col.field);
                  const workspaceItem = workspaceItems.find(item => item.id === col.field);
                  
                  if (!workspaceItem) return null;

                  return (
                    <div key={col.field} className="zd:space-y-2">
                      <div
                        {...getDropZoneProps(idx, workspaceItem)}
                        className="zd:border zd:border-border zd:rounded-lg zd:p-2 zd:bg-muted/30 zd:flex zd:items-center zd:gap-2"
                      >
                        <div
                          {...getDragProps(workspaceItem, idx)}
                          data-drag-handle
                          className="zd:cursor-move zd:text-muted-foreground zd:hover:text-foreground"
                        >
                          <GripVertical className="zd:w-4 zd:h-4" />
                        </div>
                        <div className="zd:flex zd:items-center zd:justify-between zd:flex-1 zd:min-w-0">
                          <div className="zd:flex zd:flex-col zd:flex-1 zd:min-w-0">
                            <span className="zd:text-sm zd:font-medium zd:truncate">{field?.label || col.field}</span>
                            <span className="zd:text-xs zd:text-muted-foreground zd:truncate">{col.field}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfiguringField(configuringField === col.field ? null : col.field)}
                            title={t("Configure column")}
                          >
                            <Settings className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Column Configuration Panel */}
                      {configuringField === col.field && (
                        <div className="zd:border zd:border-border zd:rounded-lg zd:p-3 zd:bg-muted/20 zd:space-y-2">
                          <div className="zd:space-y-1">
                            <label className="zd:text-xs zd:font-medium zd:text-muted-foreground">{t("Column Width")}</label>
                            <div className="zd:flex zd:items-center zd:gap-2">
                              <Input
                                type="number"
                                value={(col as any).width || ""}
                                onChange={(e) => {
                                  const baseColumns = element.tableConfig?.columns || (element.fields || []).map((f, i) => ({ field: f, order: i }));
                                  const columns = [...baseColumns];
                                  const currentCol = columns.find(c => c.field === col.field);
                                  if (currentCol) {
                                    (currentCol as any).width = e.target.value ? Number(e.target.value) : undefined;
                                  }
                                  handleUpdateElement(id, {
                                    tableConfig: {
                                      ...(element.tableConfig || { showHeader: true, showBorder: true, rowHeight: 20 }),
                                      columns
                                    }
                                  });
                                }}
                                placeholder={t("Auto")}
                                min="0"
                                className="zd:flex-1 zd:text-xs"
                              />
                              <span className="zd:text-xs zd:text-muted-foreground">px</span>
                            </div>
                            <span className="zd:text-xs zd:text-muted-foreground">{t("Leave empty for automatic width")}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintTemplateBuilder({
  layout,
  onChange,
  doctype,
  fields = [],
  readonly = false,
  onPreview,
  format = "A4",
  customWidth,
  customHeight,
  guidedBackground,
  onGuidedBackgroundChange,
  templateId,
}: PrintTemplateBuilderProps) {
  const { t } = useTranslation();
  
  // Fetch doctype configuration for template generation
  const { doc: doctypeDoc } = useDoc({
    doctype: "zodula__Doctype",
    id: doctype || "",
    fields: ["tabs", "label"],
  }, [doctype]);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapSize, setSnapSize] = useState(10);
  const [zoom, setZoom] = useState(100);
  const [draggedTool, setDraggedTool] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number; elementX: number; elementY: number; visualX: number; visualY: number; initialOffsetX?: number; initialOffsetY?: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number; elementX: number; elementY: number; elementWidth: number; elementHeight: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [justFinishedSelection, setJustFinishedSelection] = useState(false);
  const [history, setHistory] = useState<PrintTemplateElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const guidedBackgroundUrlRef = useRef<string | null>(null);
  const guidedBackgroundIsFileRef = useRef<boolean>(false);
  const [hoveredAnchorElementId, setHoveredAnchorElementId] = useState<string | null>(null);
  const [selectingAnchorFor, setSelectingAnchorFor] = useState<string | null>(null); // Element ID for which we're selecting an anchor
  const [tableSettingsTab, setTableSettingsTab] = useState<string>("general"); // Top-level tab for table settings
  const [showSidebar, setShowSidebar] = useState(true); // Sidebar visibility state
  const [isDragging, setIsDragging] = useState(false); // Flag to prevent anchor recalculation during drag

  // Check if setting anchorTo would create a loop
  const wouldCreateLoop = useCallback((elementId: string, anchorToId: string, allElements: PrintTemplateElement[]): boolean => {
    if (elementId === anchorToId) return true; // Can't anchor to itself
    
    // Build dependency graph
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const hasCycle = (currentId: string): boolean => {
      if (visiting.has(currentId)) return true; // Cycle detected
      if (visited.has(currentId)) return false; // Already processed
      
      visiting.add(currentId);
      
      const element = allElements.find(el => el.id === currentId);
      if (element?.anchorTo) {
        // Check if this would create a cycle
        if (element.anchorTo === elementId) return true; // Would create cycle
        if (hasCycle(element.anchorTo)) return true;
      }
      
      // Also check the potential new anchor
      if (currentId === anchorToId) {
        // Find anchor element by code (preferred) or id (fallback)
        const anchorElement = allElements.find(el => {
          if (el.code) {
            return el.code === anchorToId;
          }
          return el.id === anchorToId;
        });
        if (anchorElement?.anchorTo === elementId) return true; // Would create cycle
        if (anchorElement?.anchorTo && hasCycle(anchorElement.anchorTo)) return true;
      }
      
      visiting.delete(currentId);
      visited.add(currentId);
      return false;
    };
    
    return hasCycle(anchorToId);
  }, []);

  // Calculate anchor position for an element (recursive for nested anchors)
  const calculateAnchorPosition = useCallback((element: PrintTemplateElement, allElements: PrintTemplateElement[], visited: Set<string> = new Set()): { x: number; y: number } => {
    if (!element.anchorTo) {
      return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
    }
    
    // Prevent infinite loops
    if (visited.has(element.id)) {
      return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
    }
    visited.add(element.id);
    
    // Find anchor element by code (preferred) or id (fallback for backward compatibility)
    const anchorElement = allElements.find(el => {
      if (el.code) {
        return el.code === element.anchorTo;
      }
      // Fallback to id for backward compatibility
      return el.id === element.anchorTo;
    });
    if (!anchorElement) {
      return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
    }
    
    // Recursively calculate anchor position (support nested anchors)
    const anchorPos = calculateAnchorPosition(anchorElement, allElements, visited);
    const anchorX = anchorPos.x;
    const anchorY = anchorPos.y;
    const anchorWidth = anchorElement.transform?.width || 0;
    const anchorHeight = anchorElement.transform?.height || 0;
    const elementWidth = element.transform?.width || 0;
    const elementHeight = element.transform?.height || 0;
    
    // Normalize offset to {x, y} format
    const offset = element.anchorOffset || { x: 0, y: 0 };
    const offsetX = typeof offset === "object" ? (offset.x || 0) : 0;
    const offsetY = typeof offset === "object" ? (offset.y || 0) : (offset || 0);
    
    // Only support top-left alignment
    // Element's top-left corner positioned relative to anchor's top-left corner
    const newX = anchorX + offsetX;
    const newY = anchorY + offsetY;
    
    return { x: newX, y: newY };
  }, []);

  // Update all anchored elements when layout changes
  const updateAnchoredElements = useCallback((elements: PrintTemplateElement[]): PrintTemplateElement[] => {
    // Build dependency graph to process anchors in correct order (topological sort)
    // Use code for dependency tracking, fallback to id
    const elementMap = new Map<string, PrintTemplateElement>();
    const codeToIdMap = new Map<string, string>(); // Map code to id for dependency tracking
    const dependencies = new Map<string, string[]>();
    
    elements.forEach(el => {
      elementMap.set(el.id, el);
      if (el.code) {
        codeToIdMap.set(el.code, el.id);
      }
      if (el.anchorTo) {
        if (!dependencies.has(el.id)) {
          dependencies.set(el.id, []);
        }
        // Find the anchor element by code or id
        const anchorElement = elements.find(a => (a.code && a.code === el.anchorTo) || (!a.code && a.id === el.anchorTo));
        if (anchorElement) {
          dependencies.get(el.id)!.push(anchorElement.id);
        }
      }
    });
    
    // Topological sort: process elements that don't have anchors first, then those that anchor to them
    const processed = new Set<string>();
    const result: PrintTemplateElement[] = [];
    const queue: PrintTemplateElement[] = elements.filter(el => !el.anchorTo);
    
    // Process elements without anchors first
    queue.forEach(el => {
      processed.add(el.id);
      result.push(el);
    });
    
    // Process anchored elements in dependency order
    let changed = true;
    while (changed) {
      changed = false;
      elements.forEach(el => {
        if (processed.has(el.id)) return;
        
        const deps = dependencies.get(el.id) || [];
        const allDepsProcessed = deps.every(depId => processed.has(depId));
        
        if (allDepsProcessed) {
          // Calculate anchor position
          const newPos = calculateAnchorPosition(el, result);
          const updated = {
            ...el,
            transform: {
              ...(el.transform || { x: 0, y: 0, width: 200, height: 30 }),
              x: newPos.x,
              y: newPos.y,
            }
          };
          result.push(updated);
          processed.add(el.id);
          changed = true;
        }
      });
    }
    
    // Add any remaining elements (shouldn't happen if no circular dependencies)
    elements.forEach(el => {
      if (!processed.has(el.id)) {
        result.push(el);
      }
    });
    
    return result;
  }, [calculateAnchorPosition]);

  // Update anchored elements when layout changes from external source (initial load)
  const isUpdatingAnchorsRef = useRef(false);
  const lastLayoutRef = useRef<string>("");
  
  useEffect(() => {
    // Skip if we're already updating anchors (to prevent infinite loops)
    if (isUpdatingAnchorsRef.current) return;
    
    // Create a stable key for the layout to detect external changes
    const layoutKey = JSON.stringify(layout.map(el => ({ 
      id: el.id, 
      x: el.transform?.x, 
      y: el.transform?.y,
      anchorTo: el.anchorTo,
      anchorPosition: el.anchorPosition,
      anchorOffset: el.anchorOffset
    })));
    
    // Only update if layout actually changed
    if (layoutKey === lastLayoutRef.current) return;
    lastLayoutRef.current = layoutKey;
    
    if (layout.length > 0) {
      const hasAnchors = layout.some(el => el.anchorTo);
      if (hasAnchors) {
        isUpdatingAnchorsRef.current = true;
        const updated = updateAnchoredElements(layout);
        // Only update if positions actually changed
        const positionsChanged = updated.some((el) => {
          const original = layout.find(o => o.id === el.id);
          return original && (el.transform?.x !== original.transform?.x || el.transform?.y !== original.transform?.y);
        });
        if (positionsChanged) {
          onChange(updated);
        }
        isUpdatingAnchorsRef.current = false;
      }
    }
  }, [layout, updateAnchoredElements, onChange]);

  const fieldOptions = useMemo(() => {
    return fields.map((field) => ({
      value: field.name,
      label: field.label || field.name,
    }));
  }, [fields]);

  // Get doctypes for reference element
  const { docs: doctypes } = useDocList({
    doctype: "zodula__Doctype",
    limit: 10000,
    sort: "name",
    order: "asc",
  });

  const doctypeOptions = useMemo(() => {
    return doctypes.map((dt: Zodula.SelectDoctype<"zodula__Doctype">) => ({
      value: dt.name || "",
      label: dt.label || dt.name || "",
    }));
  }, [doctypes]);

  // Get fields for selected reference doctype
  const selectedReferenceElement = useMemo(() => {
    return layout.find((el) => 
      selectedElements.has(el.id) && el.type === "reference"
    );
  }, [layout, selectedElements]);

  const { docs: referenceFields } = useDocList({
    doctype: "zodula__Field",
    limit: 10000,
    sort: "idx",
    order: "asc",
    filters: selectedReferenceElement?.referenceDoctype 
      ? [["doctype", "=", selectedReferenceElement.referenceDoctype]]
      : [],
  }, [selectedReferenceElement?.referenceDoctype]);

  const referenceFieldOptions = useMemo(() => {
    return referenceFields.map((field: Zodula.SelectDoctype<"zodula__Field">) => ({
      value: field.name || "",
      label: field.label || field.name || "",
    }));
  }, [referenceFields]);

  // Get reference doctype fields for child field selection (Reference Table/Extend)
  const selectedFieldElement = useMemo(() => {
    return layout.find((el) => 
      selectedElements.has(el.id) && el.type === "field" && typeof el.value === "string"
    );
  }, [layout, selectedElements]);

  const selectedFieldConfig = useMemo(() => {
    if (!selectedFieldElement || typeof selectedFieldElement.value !== "string") return null;
    return fields.find((f) => f.name === selectedFieldElement.value);
  }, [selectedFieldElement, fields]);

  const { docs: childFields } = useDocList({
    doctype: "zodula__Field",
    limit: 10000,
    sort: "idx",
    order: "asc",
    filters: selectedFieldConfig?.reference && (selectedFieldConfig.type === "Reference Table" || selectedFieldConfig.type === "Extend")
      ? [["doctype", "=", selectedFieldConfig.reference]]
      : [],
  }, [selectedFieldConfig?.reference, selectedFieldConfig?.type]);

  // Calculate page dimensions (used by template generator and other functions)
  const pageDimensions = useMemo(() => {
    if (format === "Custom" && typeof customWidth === "number" && typeof customHeight === "number" && customWidth > 0 && customHeight > 0) {
      return { width: customWidth, height: customHeight };
    }
    const selectedFormat = PAGE_FORMATS[format || "A4"];
    return selectedFormat || PAGE_FORMATS.A4;
  }, [format, customWidth, customHeight]);

  // Define snapValue first since it's used by other callbacks
  const snapValue = useCallback((value: number) => {
    if (!snapToGrid) return value;
    return Math.round(value / snapSize) * snapSize;
  }, [snapToGrid, snapSize]);

  // History management - define before functions that use it
  const addToHistory = useCallback((newLayout: PrintTemplateElement[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newLayout);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Track if template generation is in progress to prevent multiple simultaneous calls
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Helper function to generate code using timestamp + random hex
  const generateCode = useCallback((prefix: string = "") => {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 10); // 8 hex characters
    const code = `${timestamp}_${randomHex}`;
    return prefix ? `${prefix}_${code}` : code;
  }, []);

  // Generate template from doctype tabs
  const generateTemplateFromTabs = useCallback(async () => {
    if (!doctypeDoc?.tabs || !fields.length || !doctype) return;
    if (isGenerating) {
      console.warn("Template generation already in progress, skipping...");
      return;
    }
    
    // Confirm before replacing existing layout
    if (layout.length > 0) {
      const confirmed = await confirm({
        title: t("Replace Layout"),
        message: t("This will replace the current layout. Continue?"),
        confirmText: t("Replace"),
        cancelText: t("Cancel"),
        variant: "warning",
      });
      if (!confirmed) return;
    }
    
    setIsGenerating(true);
    try {
      const tabs = typeof doctypeDoc.tabs === 'string' 
        ? JSON.parse(doctypeDoc.tabs) 
        : doctypeDoc.tabs;
      
      if (!Array.isArray(tabs) || tabs.length === 0) {
        setIsGenerating(false);
        return;
      }
      
      // Cache for fetched child fields to prevent duplicate API calls
      const childFieldsCache = new Map<string, Array<{ field: string; order: number; required?: boolean; in_list_view?: boolean }>>();
      
      // Helper function to fetch child fields for a Reference Table
      const fetchChildFields = async (referenceDoctype: string, parentDoctype?: string): Promise<Array<{ field: string; order: number; required?: boolean; in_list_view?: boolean }>> => {
        // Check cache first
        if (childFieldsCache.has(referenceDoctype)) {
          return childFieldsCache.get(referenceDoctype)!;
        }
        
        try {
          // The reference doctype name should be used as-is (may contain spaces like "zerp__Invoice Item")
          // Build filter query parameters in the format the API expects: filters[0][0]=doctype&filters[0][1]==&filters[0][2]=referenceDoctype
          const filterParams = new URLSearchParams();
          filterParams.append('filters[0][0]', 'doctype');
          filterParams.append('filters[0][1]', '=');
          filterParams.append('filters[0][2]', referenceDoctype);
          
          const url = `${BASE_URL}/api/resources/zodula__Field?${filterParams.toString()}&sort=idx&order=asc&limit=10000`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to fetch child fields:", response.status, response.statusText, errorText);
            return [];
          }
          
          const data = await response.json();
          
          // API returns {docs: [...], count, limit, page} format, not a direct array
          const fieldsArray = Array.isArray(data) ? data : (data.docs || []);
          
          if (Array.isArray(fieldsArray) && fieldsArray.length > 0) {
            // Standard fields that should be excluded from child table fields
            const standardFieldNames = new Set([
              "id",
              "organization",
              "owner",
              "created_at",
              "updated_at",
              "created_by",
              "updated_by",
              "doc_status",
              "idx",
              "vector"
            ]);
            
            // Filter to only include fields that belong to the reference doctype
            // Exclude fields that reference the parent doctype (for Extend and Reference Table)
            const fields = fieldsArray
              .filter((field: any) => {
                const fieldDoctype = field.doctype || "";
                const fieldName = field.name || "";
                const fieldReference = field.reference || "";
                // Exclude if it's a standard field, or if it references the parent doctype
                const isParentReference = parentDoctype && fieldReference === parentDoctype;
                return fieldDoctype === referenceDoctype && !standardFieldNames.has(fieldName) && !isParentReference;
              })
              .map((field: any, idx: number) => ({
                field: field.name || "",
                label: field.label || field.name || "",
                order: idx,
                required: field.required === 1 || field.required === true,
                in_list_view: field.in_list_view === 1 || field.in_list_view === true
              }))
              .filter((col: any) => col.field); // Filter out empty field names
            
            // Cache the result
            childFieldsCache.set(referenceDoctype, fields);
            return fields;
          }
        } catch (error) {
          console.error("Error fetching child fields:", error);
        }
        return [];
      };
      
      // Use the extracted function from code-utils
      const doctypeLabel = doctypeDoc?.label || doctype;
      const newElements = await generateTemplateFromTabsUtil({
        tabs,
        fields: fields
          .filter(f => f.name) // Filter out fields without names
          .map(f => ({
            name: f.name!,
            label: f.label || undefined,
            type: f.type,
            reference: f.reference || undefined,
            no_print: f.no_print === 1 || (f.no_print === true as any),
          })),
        pageDimensions: pageDimensions || { width: 210, height: 297 },
        doctypeLabel,
        fetchChildFields,
        doctype,
      });
      
      // Update anchored elements to calculate final positions
      const updatedElements = updateAnchoredElements(newElements);
      
      // Count headers to debug
      const headerCount = updatedElements.filter(el => el.type === "text" && el.value === doctypeLabel).length;
      if (headerCount > 1) {
        console.error(`WARNING: Generated ${headerCount} headers! Expected only 1. Elements:`, updatedElements.map(el => ({ type: el.type, value: el.value, code: el.code })));
      }
      
      // Apply the new layout (replace existing, don't append)
      onChange(updatedElements);
      addToHistory(updatedElements);
      setSelectedElements(new Set());
      
      console.log(`Generated ${updatedElements.length} elements (${headerCount} header(s) + ${updatedElements.length - headerCount} other elements)`);
    } catch (error) {
      console.error("Error generating template from tabs:", error);
      alert(t("Failed to generate template. Please check doctype configuration."));
    } finally {
      setIsGenerating(false);
    }
  }, [doctypeDoc, fields, pageDimensions, onChange, addToHistory, t, doctype, updateAnchoredElements, isGenerating]);

  const handleAddElement = useCallback((type: string, x?: number, y?: number) => {
    if (readonly) return;
    const height = type === "line" ? snapSize : type === "anchor" ? 40 : type === "field" ? 50 : 30; // Line elements use grid size as height, anchor elements minimum 40x40, field elements minimum 50px
    const width = type === "anchor" ? 40 : 200; // Anchor elements minimum 40x40
    // Generate code for the element using timestamp + random hex
    const code = generateCode(type);
    const newElement: PrintTemplateElement = {
      id: `element_${Date.now()}`,
      code: code,
      type: type as any,
      value: type === "text" ? "New Text" : type === "custom_html" ? "" : "",
      align: "left",
      verticalAlign: "middle",
      transform: { 
        x: x !== undefined ? snapValue(x) : 0, 
        y: y !== undefined ? snapValue(y) : 0, 
        width: width, 
        height: height
      },
      ...(type === "reference" ? {
        referenceDoctype: "",
        referenceIdFilter: "",
        referenceField: "",
      } : {}),
    };
    const newLayout = [...layout, newElement];
    onChange(newLayout);
    addToHistory(newLayout);
    // Select the new element
    setSelectedElements(new Set([newElement.id]));
  }, [layout, onChange, readonly, snapValue, snapSize, addToHistory, generateCode]);

  // Handle keyboard delete
  useEffect(() => {
    if (readonly) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }
      
      // Delete or Backspace key
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElements.size > 0) {
        e.preventDefault();
        const idsToDelete = Array.from(selectedElements);
        const newLayout = layout.filter((el) => !idsToDelete.includes(el.id));
        onChange(newLayout);
        addToHistory(newLayout);
        setSelectedElements(new Set());
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [readonly, selectedElements, layout, onChange, addToHistory]);

  const handleDeleteElement = useCallback((id: string) => {
    if (readonly) return;
    const newLayout = layout.filter((el) => el.id !== id);
    onChange(newLayout);
    addToHistory(newLayout);
    setSelectedElements(new Set());
  }, [layout, onChange, readonly, addToHistory]);

  const handleUpdateElement = useCallback((id: string, updates: Partial<PrintTemplateElement>, skipHistory = false, skipAnchorRecalc = false) => {
    if (readonly) return;
    
    let newLayout = layout.map((el) => {
      if (el.id === id) {
        const updated = { ...el, ...updates };
        
        // If anchor settings changed, reset transform x/y to 0 (will be calculated from anchor)
        const anchorChanged = updates.anchorTo !== undefined || updates.anchorPosition !== undefined || updates.anchorOffset !== undefined;
        const wasAnchored = el.anchorTo !== undefined;
        const isNowAnchored = updates.anchorTo !== undefined ? updates.anchorTo !== null : wasAnchored;
        
        if (anchorChanged && isNowAnchored) {
          // Reset position when anchor settings change - it will be recalculated
          updated.transform = {
            ...(el.transform || { x: 0, y: 0, width: 200, height: 30 }),
            x: 0,
            y: 0,
            ...(updates.transform ? {
              width: updates.transform.width ?? el.transform?.width ?? 200,
              height: Math.max(
                updates.transform.height ?? el.transform?.height ?? 30
              ),
            } : {}),
          };
        } else if (updates.transform) {
        // Ensure transform is properly merged
          updated.transform = {
            ...(el.transform || { x: 0, y: 0, width: 200, height: 30 }),
            ...updates.transform,
            height: Math.max(
              updates.transform.height ?? el.transform?.height ?? 30
            ),
          };
        }
        return updated;
      }
      return el;
    });
    
    // If anchor settings changed or an element moved, update all anchored elements
    // Skip anchor recalculation during drag to prevent loops
    const anchorChanged = updates.anchorTo !== undefined || updates.anchorPosition !== undefined || updates.anchorOffset !== undefined;
    const transformChanged = updates.transform?.x !== undefined || updates.transform?.y !== undefined;
    
    if ((anchorChanged || transformChanged) && !skipAnchorRecalc && !isDragging) {
      // Update all anchored elements (including nested)
      newLayout = updateAnchoredElements(newLayout);
    }
    
    if (!skipHistory) {
      addToHistory(newLayout);
    }
    onChange(newLayout);
  }, [layout, onChange, readonly, addToHistory, updateAnchoredElements, isDragging]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && history[historyIndex - 1]) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex] || []);
    }
  }, [historyIndex, history, onChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && history[historyIndex + 1]) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex] || []);
    }
  }, [historyIndex, history, onChange]);

  // Initialize history with current layout
  useEffect(() => {
    if (history.length === 1 && history[0] && history[0].length === 0 && layout.length > 0) {
      setHistory([layout]);
      setHistoryIndex(0);
    }
  }, []);

  const handleSelectElement = useCallback((id: string, ctrlKey: boolean) => {
    if (readonly) return;
    if (ctrlKey) {
      setSelectedElements((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      setSelectedElements(new Set([id]));
    }
  }, [readonly]);

  // Get canvas-relative position from mouse event or coordinates
  const getCanvasPosition = useCallback((e: React.MouseEvent | MouseEvent | { clientX: number; clientY: number }) => {
    if (!paperRef.current || !canvasRef.current) return { x: 0, y: 0 };
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const paperRect = paperRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    
    // Get scroll offsets
    const scrollLeft = canvasRef.current.scrollLeft;
    const scrollTop = canvasRef.current.scrollTop;
    
    // Reverse the calculation from hover element:
    // hover: x = (element.x * scale) + paperRect.left - canvasRect.left + scrollLeft
    // So: element.x = (x - paperRect.left + canvasRect.left - scrollLeft) / scale
    // Where x is mouse position in canvas scrollable space
    
    // Mouse position in canvas scrollable coordinate system
    const mouseXInCanvas = e.clientX - canvasRect.left + scrollLeft;
    const mouseYInCanvas = e.clientY - canvasRect.top + scrollTop;
    
    // Paper's position in canvas scrollable coordinate system
    const paperXInCanvas = paperRect.left - canvasRect.left + scrollLeft;
    const paperYInCanvas = paperRect.top - canvasRect.top + scrollTop;
    
    // Position relative to paper (unscaled coordinates)
    const x = (mouseXInCanvas - paperXInCanvas) / scale;
    const y = (mouseYInCanvas - paperYInCanvas) / scale;
    
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }, [zoom]);

  // Handle element drag start
  const handleElementDragStart = useCallback((e: React.MouseEvent, element: PrintTemplateElement) => {
    if (readonly) return;
    e.stopPropagation();
    
    const pos = getCanvasPosition(e);
    setDraggedElementId(element.id);
    setIsDragging(true);
    // Clear hover when dragging starts
    setHoveredAnchorElementId(null);
    
    // Calculate current visual position (for anchored elements, this is the calculated position)
    const currentVisualPos = element.anchorTo 
      ? calculateAnchorPosition(element, layout)
      : { x: element.transform?.x || 0, y: element.transform?.y || 0 };
    
    // Store initial offset if anchored
    const initialOffset = element.anchorTo 
      ? (typeof element.anchorOffset === "object" 
          ? element.anchorOffset 
          : { x: 0, y: typeof element.anchorOffset === "number" ? element.anchorOffset : 0 })
      : null;
    
    setDragStartPos({
      x: pos.x,
      y: pos.y,
      elementX: element.transform?.x || 0,
      elementY: element.transform?.y || 0,
      visualX: currentVisualPos.x,
      visualY: currentVisualPos.y,
      initialOffsetX: initialOffset?.x || 0,
      initialOffsetY: initialOffset?.y || 0,
    });
    setDragCurrentPos({ x: pos.x, y: pos.y });
    
    // Select element if not already selected
    if (!selectedElements.has(element.id)) {
      setSelectedElements(new Set([element.id]));
    }
  }, [readonly, getCanvasPosition, selectedElements, layout, calculateAnchorPosition]);

  // Handle element drag - update directly without triggering anchor recalculation
  const handleElementDrag = useCallback((e: MouseEvent) => {
    if (!draggedElementId || !dragStartPos || !paperRef.current) return;
    
    const element = layout.find(el => el.id === draggedElementId);
    if (!element) return;
    
    const pos = getCanvasPosition(e as any);
    setDragCurrentPos({ x: pos.x, y: pos.y });
    
    // Calculate delta from mouse movement
    const deltaX = pos.x - dragStartPos.x;
    const deltaY = pos.y - dragStartPos.y;
    
    // Update layout directly without triggering anchor recalculation during drag
    let newLayout = layout.map((el) => {
      if (el.id === draggedElementId) {
        if (el.anchorTo) {
          // Anchored element - need to calculate offset change based on anchor alignment
          // The new visual position should be: startVisualPos + delta
          const newVisualX = dragStartPos.visualX + deltaX;
          const newVisualY = dragStartPos.visualY + deltaY;
          
          // Find anchor element to calculate offset (by code or id)
          const anchorElement = layout.find(a => {
            if (a.code) {
              return a.code === el.anchorTo;
            }
            // Fallback to id for backward compatibility
            return a.id === el.anchorTo;
          });
          if (!anchorElement) {
            // Fallback: just add delta to offset
            const initialOffsetX = dragStartPos.initialOffsetX ?? 0;
            const initialOffsetY = dragStartPos.initialOffsetY ?? 0;
            return {
              ...el,
              anchorOffset: { 
                x: snapValue(initialOffsetX + deltaX), 
                y: snapValue(initialOffsetY + deltaY) 
              },
            };
          }
          
          // Calculate anchor's visual position (might be anchored itself)
          const anchorVisualPos = calculateAnchorPosition(anchorElement, layout);
          const anchorWidth = anchorElement.transform?.width || 0;
          const anchorHeight = anchorElement.transform?.height || 0;
          const elementWidth = el.transform?.width || 0;
          const elementHeight = el.transform?.height || 0;
          
          // Only support top-left alignment
          // Offset is simply the difference between new visual position and anchor position
          const newOffsetX = newVisualX - anchorVisualPos.x;
          const newOffsetY = newVisualY - anchorVisualPos.y;
          
          return {
            ...el,
            anchorOffset: { 
              x: snapValue(newOffsetX), 
              y: snapValue(newOffsetY) 
            },
          };
        } else {
          // Not anchored - update position directly
    const newX = snapValue(dragStartPos.elementX + deltaX);
    const newY = snapValue(dragStartPos.elementY + deltaY);
    
          return {
            ...el,
      transform: {
              ...(el.transform || { x: 0, y: 0, width: 200, height: 30 }),
        x: newX,
        y: newY,
      },
          };
        }
      }
      return el;
    });
    
    // Update anchored elements positions without triggering full recalculation
    // Only update the dragged element's visual position
    if (element.anchorTo) {
      newLayout = updateAnchoredElements(newLayout);
    }
    
    // Update layout directly (skip history and anchor recalculation flag)
    onChange(newLayout);
  }, [draggedElementId, dragStartPos, getCanvasPosition, snapValue, layout, onChange, updateAnchoredElements, calculateAnchorPosition]);

  // Handle element drag end
  const handleElementDragEnd = useCallback(() => {
    setIsDragging(false);
    
    // Finalize layout with proper anchor recalculation
    if (draggedElementId) {
      const currentLayout = updateAnchoredElements(layout);
      addToHistory(currentLayout);
      onChange(currentLayout);
    }
    
    setDraggedElementId(null);
    setDragStartPos(null);
    setDragCurrentPos(null);
  }, [draggedElementId, layout, addToHistory, onChange, updateAnchoredElements]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, element: PrintTemplateElement, handle: string) => {
    if (readonly) return;
    e.stopPropagation();
    e.preventDefault();
    
    const canvasPos = getCanvasPosition(e);
    setResizingElementId(element.id);
    setResizeHandle(handle);
    setResizeStartPos({
      x: canvasPos.x,
      y: canvasPos.y,
      elementX: element.transform?.x || 0,
      elementY: element.transform?.y || 0,
      elementWidth: element.transform?.width || 200,
      elementHeight: element.transform?.height || 30,
    });
  }, [readonly, getCanvasPosition]);

  // Handle resize
  const handleResize = useCallback((e: MouseEvent) => {
    if (!resizingElementId || !resizeHandle || !resizeStartPos || !paperRef.current) return;

    const canvasPos = getCanvasPosition(e);
    const deltaX = canvasPos.x - resizeStartPos.x;
    const deltaY = canvasPos.y - resizeStartPos.y;

    const element = layout.find(el => el.id === resizingElementId);
    if (!element) return;

    let newX = resizeStartPos.elementX;
    let newY = resizeStartPos.elementY;
    let newWidth = resizeStartPos.elementWidth;
    let newHeight = resizeStartPos.elementHeight;

    // Minimum size constraints
    const minWidth = element.type === "anchor" ? 40 : 20;
    const minHeight = element.type === "anchor" ? 40 : 20;

    // Handle different resize handles
    if (resizeHandle.includes('n')) { // North (top)
      const heightChange = -deltaY;
      newHeight = Math.max(minHeight, resizeStartPos.elementHeight + heightChange);
      newY = resizeStartPos.elementY - (newHeight - resizeStartPos.elementHeight);
    }
    if (resizeHandle.includes('s')) { // South (bottom)
      newHeight = Math.max(minHeight, resizeStartPos.elementHeight + deltaY);
    }
    if (resizeHandle.includes('w')) { // West (left)
      const widthChange = -deltaX;
      newWidth = Math.max(minWidth, resizeStartPos.elementWidth + widthChange);
      newX = resizeStartPos.elementX - (newWidth - resizeStartPos.elementWidth);
    }
    if (resizeHandle.includes('e')) { // East (right)
      newWidth = Math.max(minWidth, resizeStartPos.elementWidth + deltaX);
    }

    // Apply grid snapping
    newX = snapValue(newX);
    newY = snapValue(newY);
    newWidth = snapValue(newWidth);
    newHeight = snapValue(newHeight);

    // For line elements, keep height at grid size
    const finalHeight = layout.find(el => el.id === resizingElementId)?.type === "line" 
      ? snapSize 
      : newHeight;
    
    handleUpdateElement(resizingElementId, {
      transform: {
        x: newX,
        y: newY,
        width: newWidth,
        height: finalHeight,
      },
    }, true); // Skip history during resize for performance
  }, [resizingElementId, resizeHandle, resizeStartPos, getCanvasPosition, snapValue, handleUpdateElement, layout]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    // Add to history when resize ends
    if (resizingElementId) {
      const currentLayout = layout.map((el) => {
        if (el.id === resizingElementId) {
          return { ...el };
        }
        return el;
      });
      addToHistory(currentLayout);
    }
    setResizingElementId(null);
    setResizeHandle(null);
    setResizeStartPos(null);
  }, [resizingElementId, layout, addToHistory]);

  // Set up global mouse event listeners for dragging
  useEffect(() => {
    if (draggedElementId) {
      const handleMouseMove = (e: MouseEvent) => {
        handleElementDrag(e);
      };
      
      const handleMouseUp = () => {
        handleElementDragEnd();
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedElementId, handleElementDrag, handleElementDragEnd]);

  // Set up global mouse event listeners for resizing
  useEffect(() => {
    if (resizingElementId) {
      const handleMouseMove = (e: MouseEvent) => {
        handleResize(e);
      };
      
      const handleMouseUp = () => {
        handleResizeEnd();
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingElementId, handleResize, handleResizeEnd]);

  // Set up global mouse event listeners for selection box
  useEffect(() => {
    if (selectionBox && !readonly && !draggedElementId && !resizingElementId) {
      const handleMouseMove = (e: MouseEvent) => {
        const pos = getCanvasPosition(e);
        setSelectionBox((prev) => {
          if (!prev) return null;
          const newBox = { ...prev, endX: pos.x, endY: pos.y };
          
          // Select elements within selection box
          const minX = Math.min(prev.startX, pos.x);
          const maxX = Math.max(prev.startX, pos.x);
          const minY = Math.min(prev.startY, pos.y);
          const maxY = Math.max(prev.startY, pos.y);
          
          const selected = layout.filter((el) => {
            const elX = el.transform?.x || 0;
            const elY = el.transform?.y || 0;
            const elWidth = el.transform?.width || 200;
            const elHeight = el.transform?.height || 30;
            const elRight = elX + elWidth;
            const elBottom = elY + elHeight;
            
            // Check if element overlaps with selection box
            return (
              elX < maxX && elRight > minX && elY < maxY && elBottom > minY
            );
          }).map((el) => el.id);
          
          setSelectedElements(new Set(selected));
          return newBox;
        });
      };
      
      const handleMouseUp = (e: MouseEvent) => {
        // Finalize selection before clearing selection box
        if (selectionBox) {
          const pos = getCanvasPosition(e);
          const minX = Math.min(selectionBox.startX, pos.x);
          const maxX = Math.max(selectionBox.startX, pos.x);
          const minY = Math.min(selectionBox.startY, pos.y);
          const maxY = Math.max(selectionBox.startY, pos.y);
          
          const selected = layout.filter((el) => {
            const elX = el.transform?.x || 0;
            const elY = el.transform?.y || 0;
            const elWidth = el.transform?.width || 200;
            const elHeight = el.transform?.height || 30;
            const elRight = elX + elWidth;
            const elBottom = elY + elHeight;
            
            // Check if element overlaps with selection box
            return (
              elX < maxX && elRight > minX && elY < maxY && elBottom > minY
            );
          }).map((el) => el.id);
          
          setSelectedElements(new Set(selected));
          setJustFinishedSelection(true);
          // Clear the flag after a short delay to allow click event to be prevented
          setTimeout(() => setJustFinishedSelection(false), 0);
        }
        setSelectionBox(null);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [selectionBox, readonly, draggedElementId, resizingElementId, getCanvasPosition, layout]);

  // Handle guided background URL
  useEffect(() => {
    if (guidedBackground) {
      if (guidedBackground instanceof File) {
        // Create object URL for File
        if (guidedBackgroundUrlRef.current && guidedBackgroundIsFileRef.current) {
          URL.revokeObjectURL(guidedBackgroundUrlRef.current);
        }
        guidedBackgroundUrlRef.current = URL.createObjectURL(guidedBackground);
        guidedBackgroundIsFileRef.current = true;
      } else {
        // Clean up previous file URL if any
        if (guidedBackgroundUrlRef.current && guidedBackgroundIsFileRef.current) {
          URL.revokeObjectURL(guidedBackgroundUrlRef.current);
        }
        // Use string URL directly
        guidedBackgroundUrlRef.current = guidedBackground;
        guidedBackgroundIsFileRef.current = false;
      }
    } else {
      // Clean up previous file URL if any
      if (guidedBackgroundUrlRef.current && guidedBackgroundIsFileRef.current) {
        URL.revokeObjectURL(guidedBackgroundUrlRef.current);
      }
      guidedBackgroundUrlRef.current = null;
      guidedBackgroundIsFileRef.current = false;
    }
    
    return () => {
      // Clean up object URL if it was created from File
      if (guidedBackgroundUrlRef.current && guidedBackgroundIsFileRef.current) {
        URL.revokeObjectURL(guidedBackgroundUrlRef.current);
        guidedBackgroundUrlRef.current = null;
        guidedBackgroundIsFileRef.current = false;
      }
    };
  }, [guidedBackground]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
      if (guidedBackgroundUrlRef.current && guidedBackgroundIsFileRef.current) {
        URL.revokeObjectURL(guidedBackgroundUrlRef.current);
      }
    };
  }, []);

  // Calculate dynamic page height based on elements
  const dynamicPageHeight = useMemo(() => {
    const baseHeight = pageDimensions?.height || 297;
    if (layout.length === 0) {
      return baseHeight;
    }
    // Find the bottommost element
    const maxBottom = Math.max(
      ...layout.map((el) => {
        const y = el.transform?.y || 0;
        const height = el.transform?.height || 30;
        return y + height;
      })
    );
    // Add some padding (20mm) and ensure minimum height
    return Math.max(baseHeight, maxBottom + 20);
  }, [layout, pageDimensions]);

  // Calculate page break positions
  const pageBreakPositions = useMemo(() => {
    const pageHeight = pageDimensions?.height || 297;
    const totalHeight = dynamicPageHeight;
    const breaks: number[] = [];
    
    // Add a break at each page boundary (starting from the second page)
    let currentY = pageHeight;
    while (currentY < totalHeight) {
      breaks.push(currentY);
      currentY += pageHeight;
    }
    
    return breaks;
  }, [pageDimensions, dynamicPageHeight]);

  const renderElement = useCallback((element: PrintTemplateElement, index: number) => {
    const isSelected = selectedElements.has(element.id);
    const isDragging = draggedElementId === element.id;
    
    // Use element's transform position (which is already updated by anchor calculation)
    // Only recalculate during drag
    const baseX = element.transform?.x || 0;
    const baseY = element.transform?.y || 0;
    
    // Use drag position if dragging, otherwise use element's stored position
    const currentX = isDragging && dragCurrentPos && dragStartPos
      ? snapValue(dragStartPos.elementX + (dragCurrentPos.x - dragStartPos.x))
      : snapValue(baseX);
    const currentY = isDragging && dragCurrentPos && dragStartPos
      ? snapValue(dragStartPos.elementY + (dragCurrentPos.y - dragStartPos.y))
      : snapValue(baseY);

    const elementStyle: React.CSSProperties = {
      position: "absolute",
      left: `${currentX}px`,
      top: `${currentY}px`,
      width: `${element.transform?.width || 200}px`,
      height: `${element.transform?.height || 30}px`,
      cursor: readonly ? "default" : isDragging ? "grabbing" : "grab",
      userSelect: "none",
      zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
      opacity: isDragging ? 0.8 : 1,
      transition: isDragging ? "none" : "opacity 0.2s",
      ...element.style,
    };

    // Get alignment classes
    const horizontalAlign = element.align || "left";
    const verticalAlign = element.verticalAlign || "middle";
    
    const alignClasses = {
      horizontal: {
        left: "zd:text-left",
        center: "zd:text-center",
        right: "zd:text-right",
      },
      vertical: {
        top: "zd:items-start",
        middle: "zd:items-center",
        bottom: "zd:items-end",
      },
    };

    let content: React.ReactNode;
    switch (element.type) {
      case "field": {
        // Find the field config to determine its type
        const fieldConfig = fields.find((f) => f.name === element.value);
        const fieldType = fieldConfig?.type;
        const isReferenceTable = fieldType === "Reference Table";
        const isExtend = fieldType === "Extend";
        
        if (isReferenceTable) {
          // Show table preview for Reference Table (like it will appear in PDF)
          const childFields = element.fields || [];
          const tableConfig = element.tableConfig || {};
          // Ensure columns format is correct: { field: string, order?: number, width?: number }[]
          // Use tableConfig.columns if available and valid, otherwise create from fields array
          let columns: Array<{ field: string; order?: number; width?: number }> = [];
          
          if (tableConfig.columns && Array.isArray(tableConfig.columns) && tableConfig.columns.length > 0) {
            // Use existing columns, but ensure they have field property
            columns = tableConfig.columns.filter((col: any) => col && col.field && typeof col.field === "string");
          }
          
          // If no valid columns from tableConfig, create from fields array
          if (columns.length === 0 && childFields.length > 0) {
            columns = childFields.map((f, idx) => ({ field: f, order: idx }));
          }
          
          const sortedColumns = [...columns]
            .filter((col: any) => col && col.field && typeof col.field === "string") // Filter out invalid columns
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          // Debug: log to help diagnose child fields issue
          if (sortedColumns.length === 0) {
            console.warn("Reference Table has no valid columns:", { 
              childFields, 
              tableConfig, 
              columns,
              elementFields: element.fields,
              elementTableConfig: element.tableConfig
            });
          }
          const showHeader = tableConfig.showHeader !== false;
          const showBorder = tableConfig.showBorder !== false;
          const rowHeight = tableConfig.rowHeight || 20;
          
          // Get field labels from the fields prop (which contains Field objects)
          const getFieldLabel = (fieldName: string) => {
            const field = fields.find((f) => f.name === fieldName);
            return field?.label || fieldName;
          };
          
          // Font styles for table cells
          const tableTextStyle: React.CSSProperties = {
            fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : undefined,
            fontWeight: element.style?.fontWeight,
            fontStyle: element.style?.fontStyle,
            textDecoration: element.style?.textDecoration,
          };
          
          // Calculate column widths to match element width
          const elementWidth = element.transform?.width || 200
          const specifiedWidths = sortedColumns.filter((col: any) => col.width).map((col: any) => col.width)
          const totalSpecifiedWidth = specifiedWidths.reduce((sum: number, w: number) => sum + w, 0)
          const columnsWithWidth = sortedColumns.filter((col: any) => col.width).length
          const columnsWithoutWidth = sortedColumns.length - columnsWithWidth
          
          content = (
            <div className={cn("zd:h-full zd:w-full zd:overflow-hidden", alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical])}>
              {sortedColumns.length > 0 ? (
                <table 
                  className="zd:text-xs"
                  style={{ 
                    borderCollapse: "collapse",
                    borderSpacing: 0,
                    width: `${elementWidth}px`,
                    tableLayout: "fixed"
                  }}
                >
                  {showHeader && (
                    <thead>
                      <tr>
                        {sortedColumns.map((col) => {
                          // Calculate column width
                          let colWidth: number | string = "auto"
                          if ((col as any).width) {
                            colWidth = (col as any).width
                          } else if (columnsWithoutWidth > 0) {
                            // Distribute remaining width equally among unspecified columns
                            const remainingWidth = elementWidth - totalSpecifiedWidth
                            colWidth = remainingWidth / columnsWithoutWidth
                          } else {
                            // All columns have width, distribute equally
                            colWidth = elementWidth / sortedColumns.length
                          }
                          
                          return (
                            <th
                              key={col.field}
                              className="zd:px-1 zd:py-1 zd:font-medium zd:text-left"
                              style={{
                                width: typeof colWidth === "number" ? `${colWidth}px` : colWidth,
                                minWidth: "30px",
                                height: `${rowHeight}px`,
                                border: showBorder ? "1px solid #000" : "none",
                                padding: "2px",
                                fontWeight: element.style?.fontWeight || "bold",
                                backgroundColor: "#f0f0f0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                ...tableTextStyle,
                              }}
                            >
                              {getFieldLabel(col.field)}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {/* Show sample rows */}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rowIdx) => (
                      <tr 
                        key={rowIdx} 
                        style={{
                          height: `${rowHeight}px`
                        }}
                      >
                        {sortedColumns.map((col) => {
                          // Calculate column width (same logic as header)
                          let colWidth: number | string = "auto"
                          if ((col as any).width) {
                            colWidth = (col as any).width
                          } else if (columnsWithoutWidth > 0) {
                            const remainingWidth = elementWidth - totalSpecifiedWidth
                            colWidth = remainingWidth / columnsWithoutWidth
                          } else {
                            colWidth = elementWidth / sortedColumns.length
                          }
                          
                          return (
                            <td
                              key={col.field}
                              className="zd:px-1 zd:py-1"
                              style={{
                                height: `${rowHeight}px`,
                                width: typeof colWidth === "number" ? `${colWidth}px` : colWidth,
                                border: showBorder ? "1px solid #000" : "none",
                                padding: "2px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                ...tableTextStyle,
                              }}
                            >
                              <span className="zd:text-muted-foreground" style={tableTextStyle}>Sample</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="zd:flex zd:items-center zd:justify-center zd:h-full zd:text-xs zd:text-muted-foreground">
                  Select child fields
              </div>
              )}
            </div>
          );
        } else if (isExtend) {
          // Show section preview for Extend
          const childFields = element.fields || [];
          content = (
            <div className={cn("zd:p-2 zd:h-full zd:flex zd:flex-col zd:gap-2", alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical])}>
              <div className={cn("zd:text-xs zd:font-semibold", alignClasses.horizontal[horizontalAlign as keyof typeof alignClasses.horizontal])}>
                {typeof element.value === "string" ? element.value : "Select Field"}
              </div>
              <div className="zd:border-l-2 zd:border-primary zd:pl-3 zd:flex-1 zd:min-h-[40px]">
                <div className="zd:text-xs zd:text-muted-foreground">
                  {childFields.length > 0 ? `${childFields.length} field${childFields.length > 1 ? "s" : ""} selected` : "Select child fields"}
                </div>
              </div>
            </div>
          );
        } else {
          // Standard field preview - show as {{field}}
          const fieldName = typeof element.value === "string" ? element.value : "field";
          const labelText = element.label || "";
          const labelPos = element.labelPosition || "left";
          
          const textStyle: React.CSSProperties = {
            fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : undefined,
            fontWeight: element.style?.fontWeight,
            fontStyle: element.style?.fontStyle,
            textDecoration: element.style?.textDecoration,
          };
          
          const renderFieldContent = () => (
            <span
              className={cn(
                "zd:text-sm zd:font-mono zd:block zd:w-full",
                alignClasses.horizontal[horizontalAlign as keyof typeof alignClasses.horizontal]
              )}
              style={textStyle}
            >
              {`{{${fieldName}}}`}
            </span>
          );
          
          const horizontalItems = {
            left: "zd:items-start",
            center: "zd:items-center",
            right: "zd:items-end",
          } as const;
          
          const renderLabel = () => labelText ? (
            <span
              className={cn(
                "zd:text-xs zd:text-muted-foreground zd:whitespace-nowrap zd:block zd:w-full",
                alignClasses.horizontal[horizontalAlign as keyof typeof alignClasses.horizontal]
              )}
              style={textStyle}
            >
              {labelText}
            </span>
          ) : null;
          
          const verticalColumn = {
            top: "zd:justify-start",
            middle: "zd:justify-center",
            bottom: "zd:justify-end",
          } as const;
          
          if (labelPos === "top" || labelPos === "bottom") {
            content = (
              <div className={cn("zd:flex zd:flex-col zd:gap-1 zd:p-0 zd:h-full")}>
                {labelPos === "top" && renderLabel()}
                <div
                  className={cn(
                    "zd:flex zd:flex-1 zd:min-h-0",
                    alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical]
                  )}
                >
                {renderFieldContent()}
                </div>
                {labelPos === "bottom" && renderLabel()}
              </div>
            );
          } else {
            content = (
              <div className={cn("zd:flex zd:gap-2 zd:p-0 zd:h-full zd:items-center", 
                labelPos === "left" ? "zd:flex-row" : "zd:flex-row-reverse",
                alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical])}>
                {renderLabel()}
                {renderFieldContent()}
              </div>
            );
          }
        }
        break;
      }
      case "text":
        content = (
          <div className={cn("zd:p-0 zd:h-full zd:flex", alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical])}>
            <span
              className={cn("zd:text-sm zd:w-full", alignClasses.horizontal[horizontalAlign as keyof typeof alignClasses.horizontal])}
              style={{
                fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : undefined,
                fontWeight: element.style?.fontWeight,
                fontStyle: element.style?.fontStyle,
                textDecoration: element.style?.textDecoration,
              }}
            >
              {typeof element.value === "string" ? element.value : "Text"}
            </span>
          </div>
        );
        break;
      case "image": {
        // Get image preview URL
        const imageValue = element.value;
        const isFile = imageValue && typeof imageValue === 'object' && 'name' in imageValue && 'size' in imageValue && 'type' in imageValue;
        const isStringPath = typeof imageValue === 'string' && imageValue.length > 0;
        
        let imageUrl: string | null = null;
        
        if (isFile) {
          // Check if we already have an object URL for this element
          const existingUrl = objectUrlsRef.current.get(element.id);
          if (existingUrl) {
            URL.revokeObjectURL(existingUrl);
          }
          const objectUrl = URL.createObjectURL(imageValue as File);
          objectUrlsRef.current.set(element.id, objectUrl);
          imageUrl = objectUrl;
        } else if (isStringPath) {
          if (imageValue.startsWith('http')) {
            imageUrl = imageValue;
          } else {
            // Construct file URL - assuming it's a file path from the item
            const urlPrefix = [BASE_URL, "files", "zodula__Print Template Item", element.id || "temp", "image", ""].join("/");
            imageUrl = `${urlPrefix}${imageValue}`;
          }
        }
        
        const imageAlignClasses = {
          horizontal: {
            left: "zd:justify-start",
            center: "zd:justify-center",
            right: "zd:justify-end",
          },
          vertical: {
            top: "zd:items-start",
            middle: "zd:items-center",
            bottom: "zd:items-end",
          },
        };
        
        content = (
          <div className={cn(
            "zd:w-full zd:h-full zd:flex zd:overflow-hidden zd:bg-muted/30",
            imageAlignClasses.horizontal[horizontalAlign],
            imageAlignClasses.vertical[verticalAlign]
          )}>
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt="Preview" 
                className="zd:max-w-full zd:max-h-full zd:object-contain zd:pointer-events-none zd:select-none"
                draggable={false}
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="zd:flex zd:flex-col zd:items-center zd:gap-2 zd:text-muted-foreground">
                <Image className="zd:w-8 zd:h-8" />
                <span className="zd:text-xs">No Image</span>
              </div>
            )}
          </div>
        );
        break;
      }
      case "line":
        // Line elements align with grid - height matches grid size
        content = (
          <div className="zd:h-full zd:flex zd:items-center">
            <div className="zd:w-full zd:border-t zd:border-border" />
          </div>
        );
        break;
      case "reference": {
        // Show as {{Doctype.field}}
        const doctypeName = element.referenceDoctype || "Doctype";
        const fieldName = element.referenceField || "field";
        const displayText = `{{${doctypeName}.${fieldName}}}`;
        const labelText = element.label || "";
        const labelPos = element.labelPosition || "left";
        
        const textStyle: React.CSSProperties = {
          fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : undefined,
          fontWeight: element.style?.fontWeight,
          fontStyle: element.style?.fontStyle,
          textDecoration: element.style?.textDecoration,
        };
        
        const renderReferenceContent = () => (
          <span
            className={cn(
              "zd:text-sm zd:font-mono zd:block zd:w-full zd:flex-1 zd:min-w-0",
              alignClasses.horizontal[horizontalAlign as keyof typeof alignClasses.horizontal]
            )}
            style={textStyle}
          >
            {displayText}
          </span>
        );
        
        const horizontalItems = {
          left: "zd:items-start",
          center: "zd:items-center",
          right: "zd:items-end",
        } as const;
        
        const renderLabel = () => labelText ? (
          <span
            className={cn(
              "zd:text-xs zd:text-muted-foreground zd:whitespace-nowrap zd:block zd:w-full",
              alignClasses.horizontal[horizontalAlign as keyof typeof alignClasses.horizontal]
            )}
            style={textStyle}
          >
            {labelText}
          </span>
        ) : null;
        
        const verticalColumn = {
          top: "zd:justify-start",
          middle: "zd:justify-center",
          bottom: "zd:justify-end",
        } as const;
        
        if (labelPos === "top" || labelPos === "bottom") {
          content = (
            <div className={cn("zd:flex zd:flex-col zd:gap-1 zd:p-0 zd:h-full")}>
              {labelPos === "top" && renderLabel()}
              <div
                className={cn(
                  "zd:flex zd:flex-1 zd:min-h-0",
                  alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical]
                )}
              >
              {renderReferenceContent()}
              </div>
              {labelPos === "bottom" && renderLabel()}
            </div>
          );
        } else {
          content = (
            <div className={cn("zd:flex zd:gap-2 zd:p-0 zd:h-full zd:items-center", 
              labelPos === "left" ? "zd:flex-row" : "zd:flex-row-reverse",
              alignClasses.vertical[verticalAlign as keyof typeof alignClasses.vertical])}>
              {renderLabel()}
              {renderReferenceContent()}
            </div>
          );
        }
        break;
      }
      case "custom_html":
        content = (
          <div className="zd:h-full zd:flex zd:flex-col">
            <div className="zd:flex-1 zd:border zd:border-border zd:rounded zd:bg-muted/30 zd:overflow-auto">
              <pre className="zd:text-xs zd:text-muted-foreground zd:whitespace-pre-wrap zd:p-2">
                {typeof element.value === "string" && element.value.length > 0 
                  ? element.value.substring(0, 100) + (element.value.length > 100 ? "..." : "")
                  : t("Enter binba template code")}
              </pre>
            </div>
          </div>
        );
        break;
      case "anchor":
        content = (
          <div className={cn("zd:h-full zd:w-full zd:border-2 zd:border-dashed zd:border-blue/50 zd:rounded zd:bg-blue/5 zd:flex zd:items-center zd:justify-center")}>
            <div className="zd:text-xs zd:text-primary zd:font-medium zd:flex zd:flex-col zd:items-center zd:gap-1">
              <Anchor className="zd:w-4 zd:h-4" />
              <span>Anchor Point</span>
            </div>
          </div>
        );
        break;
      default:
        content = <div className="zd:p-0">{typeof element.value === "string" ? element.value : ""}</div>;
    }

    const isResizing = resizingElementId === element.id;
    const isAnchored = element.anchorTo !== undefined && element.anchorTo !== null;
    // Check if this element is the anchor target for any selected element (by code or id)
    const isAnchorTarget = Array.from(selectedElements).some(selectedId => {
      const selectedElement = layout.find(el => el.id === selectedId);
      if (!selectedElement?.anchorTo) return false;
      // Match by code (preferred) or id (fallback)
      return (element.code && element.code === selectedElement.anchorTo) || 
             (!element.code && element.id === selectedElement.anchorTo);
    });

    return (
      <div
        key={element.id}
        data-element-id={element.id}
        className={cn(
          "zd:absolute zd:group",
          isSelected && "zd:border zd:border-blue-500",
          isAnchored && "zd:opacity-90", // Visual indicator that element is anchored
          isAnchorTarget && "zd:border-2 zd:border-dashed zd:border-blue-500/70 zd:rounded-lg" // Show dashed border when selected element anchors to this
        )}
        style={{
          ...elementStyle,
          cursor: readonly ? "default" : elementStyle.cursor,
        }}
        onMouseEnter={(e) => {
          // Show hover effect in anchor selection mode (not dragging)
          if (selectingAnchorFor && !isDragging && element.id !== selectingAnchorFor) {
            setHoveredAnchorElementId(element.id);
          }
        }}
        onMouseLeave={(e) => {
          // Clear hover effect when leaving the element
          if (selectingAnchorFor) {
            // Use a small delay to allow child element hover to work
            const timeoutId = setTimeout(() => {
              setHoveredAnchorElementId(null);
            }, 50);
            (e.currentTarget as any).__hoverTimeout = timeoutId;
          }
        }}
        onMouseDown={(e) => {
          if (!readonly && !(e.target as HTMLElement).closest('.resize-handle')) {
            // In anchor selection mode we only prevent drag/select; anchor is set on click
            if (selectingAnchorFor) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            
            // Normal drag behavior - allow dragging even if anchored (will update offset)
            // Prevent image drag if clicking on image
            if ((e.target as HTMLElement).tagName === 'IMG') {
              e.preventDefault();
            }
            handleElementDragStart(e, element);
          }
        }}
        onDragStart={(e) => {
          // Prevent default drag behavior for images
          if ((e.target as HTMLElement).tagName === 'IMG') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onClick={(e) => {
          // Anchor selection mode: single click sets anchor
          if (selectingAnchorFor) {
            e.preventDefault();
            e.stopPropagation();
            // Keep original element selected
            setSelectedElements(new Set([selectingAnchorFor]));
            if (element.id !== selectingAnchorFor) {
              if (wouldCreateLoop(selectingAnchorFor, element.id, layout)) {
                alert(t("Cannot anchor: This would create a circular dependency"));
                setSelectingAnchorFor(null);
                setHoveredAnchorElementId(null);
                return;
              }
              const selectedElement = layout.find(el => el.id === selectingAnchorFor);
              if (selectedElement) {
                const currentOffset = typeof selectedElement.anchorOffset === "object" 
                  ? selectedElement.anchorOffset 
                  : { x: 0, y: typeof selectedElement.anchorOffset === "number" ? selectedElement.anchorOffset : 10 };
                const anchorCode = element.code || element.id;
                handleUpdateElement(selectingAnchorFor, { 
                  anchorTo: anchorCode,
                  anchorPosition: "top-left",
                  anchorOffset: currentOffset
                });
              }
            }
            setSelectingAnchorFor(null);
            setHoveredAnchorElementId(null);
            return;
          }
          // Don't select if clicking on delete button
          if ((e.target as HTMLElement).closest('button[title="Delete Element"]')) {
            return;
          }
          if (!isDragging && !isResizing && !(e.target as HTMLElement).closest('.resize-handle')) {
            handleSelectElement(element.id, e.ctrlKey || e.metaKey);
          }
        }}
      >
        {/* Selection highlight border */}
        {isSelected && !isDragging && !isResizing && (
          <>
            <div className="zd:absolute zd:inset-0 zd:ring-1 zd:ring-blue-500 zd:pointer-events-none" />
            <div className="zd:absolute zd:inset-0 zd:bg-blue-500/30 zd:pointer-events-none" />
          </>
        )}
        
        {/* Dragging highlight */}
        {(isDragging || isResizing) && (
          <>
            <div className="zd:absolute zd:inset-0 zd:ring-1 zd:ring-blue-500 zd:pointer-events-none" />
            <div className="zd:absolute zd:inset-0 zd:bg-blue-500/40 zd:pointer-events-none" />
          </>
        )}

        {/* Green ring hover indicator for anchor selection mode */}
        {selectingAnchorFor && hoveredAnchorElementId === element.id && !isDragging && element.id !== selectingAnchorFor && (
          <>
            <div 
              className="zd:absolute zd:inset-0 zd:ring-2 zd:ring-green-500 zd:rounded-lg zd:pointer-events-none zd:z-[100]"
              style={{ 
                boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.5), 0 0 10px rgba(34, 197, 94, 0.3)',
              }}
            />
            <div 
              className="zd:absolute zd:-inset-1 zd:ring-2 zd:ring-green-500 zd:rounded-lg zd:pointer-events-none zd:z-[100] zd:animate-pulse"
            />
          </>
        )}

        {/* Content */}
        <div 
          className="zd:h-full zd:w-full zd:relative zd:overflow-hidden"
          onMouseEnter={(e) => {
            // Also handle hover on content div to catch events from child elements
            if (selectingAnchorFor && !isDragging && element.id !== selectingAnchorFor) {
              // Clear any pending timeout
              const parent = e.currentTarget.parentElement;
              if (parent && (parent as any).__hoverTimeout) {
                clearTimeout((parent as any).__hoverTimeout);
                delete (parent as any).__hoverTimeout;
              }
              setHoveredAnchorElementId(element.id);
            }
          }}
        >
          {content}
        </div>

        {/* Resize handles - show even when anchored (anchored elements can resize but not drag) */}
        {isSelected && !readonly && !isDragging && (
          <>
            {/* Corner handles - smaller */}
            <div
              className="resize-handle zd:absolute zd:top-0 zd:left-0 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-nwse-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'nw')}
            />
            <div
              className="resize-handle zd:absolute zd:top-0 zd:right-0 zd:translate-x-1/2 zd:-translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-nesw-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'ne')}
            />
            <div
              className="resize-handle zd:absolute zd:bottom-0 zd:left-0 zd:-translate-x-1/2 zd:translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-nesw-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'sw')}
            />
            <div
              className="resize-handle zd:absolute zd:bottom-0 zd:right-0 zd:translate-x-1/2 zd:translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-nwse-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'se')}
            />
            {/* Edge handles - smaller and centered */}
            <div
              className="resize-handle zd:absolute zd:top-0 zd:left-1/2 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-ns-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'n')}
            />
            <div
              className="resize-handle zd:absolute zd:bottom-0 zd:left-1/2 zd:-translate-x-1/2 zd:translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-ns-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 's')}
            />
            <div
              className="resize-handle zd:absolute zd:left-0 zd:top-1/2 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-ew-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'w')}
            />
            <div
              className="resize-handle zd:absolute zd:right-0 zd:top-1/2 zd:translate-x-1/2 zd:-translate-y-1/2 zd:w-2 zd:h-2 zd:bg-blue-500 zd:cursor-ew-resize zd:z-50"
              onMouseDown={(e) => handleResizeStart(e, element, 'e')}
            />
          </>
        )}


        {/* Drag handle indicator */}
        {!readonly && !isSelected && (
          <div className="zd:absolute zd:top-1 zd:left-1 zd:opacity-0 group-hover:zd:opacity-100 zd:transition-opacity zd:pointer-events-none">
            <div className="zd:bg-primary zd:text-primary-foreground zd:text-xs zd:px-2 zd:py-1 zd:rounded zd:flex zd:items-center zd:gap-1">
              <GripVertical className="zd:w-3 zd:h-3" />
              <span>Drag</span>
            </div>
          </div>
        )}

        {/* Position indicator when dragging */}
        {isDragging && dragCurrentPos && (
          <div className="zd:absolute zd:-top-8 zd:left-0 zd:bg-primary zd:text-primary-foreground zd:text-xs zd:px-2 zd:py-1 zd:rounded zd:whitespace-nowrap zd:z-40">
            X: {Math.round(currentX)} Y: {Math.round(currentY)}
          </div>
        )}
      </div>
    );
  }, [
    selectedElements,
    draggedElementId,
    dragStartPos,
    dragCurrentPos,
    readonly,
    handleSelectElement,
    handleDeleteElement,
    handleElementDragStart,
    snapValue,
  ]);

  return (
    <div className="zd:flex zd:flex-1 zd:h-full zd:relative">
      {/* Main Canvas Area */}
      <div className="zd:flex-1 zd:flex zd:flex-col zd:overflow-hidden">
        {/* Top Toolbar - Minimal Design */}
        <div className="zd:bg-background zd:border-b zd:border-border zd:px-3 zd:py-2 zd:flex zd:items-center zd:gap-2">
          {/* Grid Toggle */}
          <Button
            variant={showGrid ? "solid" : "outline"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid"
          >
            <Grid3x3 className="zd:w-4 zd:h-4" />
            <span>Grid</span>
          </Button>

          {/* Snap Settings */}
          <div className="zd:flex zd:items-center zd:gap-2">
            <Checkbox
                checked={snapToGrid}
              onCheckedChange={(checked) => setSnapToGrid(checked === true)}
              label="Snap"
              />
            <div className="zd:w-px zd:h-4 zd:bg-border" />
            <Select
              value={String(snapSize)}
              onChange={(value) => setSnapSize(Number(value))}
              options={[
                { value: "5", label: "5px" },
                { value: "10", label: "10px" },
                { value: "20", label: "20px" },
              ]}
              className="zd:w-16"
            />
          </div>

          {/* Divider */}
          <div className="zd:w-px zd:h-4 zd:bg-border" />

          {/* Template Generator */}
          {!readonly && doctype && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    title={t("Generate Template from Doctype Tabs")}
                  >
                    <Wand2 className="zd:w-4 zd:h-4" />
                    <span>{t("Generate")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>{t("Template Generator")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={generateTemplateFromTabs}
                    disabled={!doctypeDoc?.tabs || !fields.length || isGenerating}
                  >
                    <Wand2 className="zd:w-4 zd:h-4 zd:mr-2" />
                    {t("Generate from Doctype Tabs")}
                  </DropdownMenuItem>
                  {(!doctypeDoc?.tabs || !fields.length) && (
                    <div className="zd:px-2 zd:py-1.5 zd:text-xs zd:text-muted-foreground">
                      {!doctypeDoc?.tabs 
                        ? t("Doctype has no tabs configured")
                        : !fields.length 
                        ? t("No fields available")
                        : ""}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="zd:w-px zd:h-4 zd:bg-border" />
            </>
          )}

          {/* History Controls */}
          {!readonly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex === 0}
                title="Undo"
              >
                <Undo className="zd:w-4 zd:h-4" />
                <span>Undo</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo"
              >
                <Redo className="zd:w-4 zd:h-4" />
                <span>Redo</span>
              </Button>
              <div className="zd:w-px zd:h-4 zd:bg-border" />
            </>
          )}

          {/* Preview */}
          {onPreview && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onPreview}
                title="Preview Template"
              >
                <Eye className="zd:w-4 zd:h-4" />
                <span>Preview</span>
              </Button>
              <div className="zd:w-px zd:h-4 zd:bg-border" />
            </>
          )}

          {/* Zoom Controls */}
          <div className="zd:flex zd:items-center zd:gap-1 zd:ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.max(25, zoom - 25))}
              title="Zoom Out"
            >
              <ZoomOut className="zd:w-4 zd:h-4" />
            </Button>
            <span className="zd:text-xs zd:font-medium zd:w-12 zd:text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              title="Zoom In"
            >
              <ZoomIn className="zd:w-4 zd:h-4" />
            </Button>
            <div className="zd:w-px zd:h-4 zd:bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(100)}
              title="Reset Zoom"
            >
              Reset
            </Button>
          </div>
          
          {/* Settings (Guided Background) */}
          {!readonly && onGuidedBackgroundChange && (
            <>
              <div className="zd:w-px zd:h-4 zd:bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={t("Settings")}
                  >
                    <Settings className="zd:w-4 zd:h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("Guided Background")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="zd:px-2 zd:py-2">
                    <FormControl
                      field={{
                        type: "File",
                        name: "guided_background",
                        doctype: "zodula__Print Template",
                        accept: "image/*",
                      }}
                      fieldKey="guided_background"
                      value={guidedBackground}
                      onChange={(fieldName, value) => {
                        if (onGuidedBackgroundChange) {
                          onGuidedBackgroundChange(value as string | File | null);
                        }
                      }}
                      docId={templateId}
                      hideFormControl={true}
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          {/* Sidebar Toggle */}
          {!readonly && (
            <>
              <div className="zd:w-px zd:h-4 zd:bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                title={showSidebar ? t("Hide Sidebar") : t("Show Sidebar")}
              >
                {showSidebar ? (
                  <ChevronRight className="zd:w-4 zd:h-4" />
                ) : (
                  <ChevronLeft className="zd:w-4 zd:h-4" />
                )}
                <span>{t("Sidebar")}</span>
              </Button>
            </>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="zd:flex-1 zd:overflow-auto zd:bg-muted/30 zd:relative zd:p-8"
          style={{ minHeight: 0 }}
        >
          {/* Anchor Selection Mode Indicator */}
          {selectingAnchorFor && (
            <div className="zd:fixed zd:top-20 zd:left-1/2 zd:-translate-x-1/2 zd:z-[1000] zd:bg-primary zd:text-primary-foreground zd:px-4 zd:py-2 zd:rounded-lg zd:shadow-lg zd:border zd:ring-blue-500">
              <p className="zd:text-sm zd:font-medium">
                {t("Anchor Selection Mode: Click on an element to anchor to it")}
                {hoveredAnchorElementId && ` (Hovering: ${hoveredAnchorElementId.substring(0, 8)}...)`}
              </p>
            </div>
          )}
          
          {/* Element Hover Indicator for Anchor Selection */}
          {selectingAnchorFor && !isDragging && hoveredAnchorElementId && (
            <PrintTemplateElementHover
              elementId={hoveredAnchorElementId}
              layout={layout}
              zoom={zoom}
              paperRef={paperRef}
              canvasRef={canvasRef}
            />
          )}
          
          <div
          onMouseMove={(e) => {
            // Track hover in anchor selection mode at canvas level
            if (selectingAnchorFor && !isDragging) {
              const target = e.target as HTMLElement;
              // Find the element that contains this target
              const elementDiv = target.closest('[data-element-id]') as HTMLElement;
              if (elementDiv) {
                const elementId = elementDiv.getAttribute('data-element-id');
                if (elementId && elementId !== selectingAnchorFor) {
                  setHoveredAnchorElementId(elementId);
                } else {
                  setHoveredAnchorElementId(null);
                }
              } else {
                setHoveredAnchorElementId(null);
              }
            }
          }}
          onMouseDown={(e) => {
            // If we're in anchor selection mode, don't start selection box
            if (selectingAnchorFor) {
              // Only cancel if clicking on actual canvas background (not on an element)
              const target = e.target as HTMLElement;
              if (target === e.currentTarget || 
                  target === paperRef.current || 
                  (paperRef.current && target.closest('.zd\\:relative') === paperRef.current)) {
                // Cancel anchor selection if clicking on canvas background
                setSelectingAnchorFor(null);
                setHoveredAnchorElementId(null);
              }
              return;
            }
            // Start selection box if clicking on canvas background (not on an element)
            if (!readonly && !draggedTool && !draggedElementId && !resizingElementId) {
              const target = e.target as HTMLElement;
              // Check if clicking on canvas background or paper (not on an element)
              if (target === e.currentTarget || 
                  target === paperRef.current || 
                  (paperRef.current && target.closest('.zd\\:relative') === paperRef.current)) {
                e.preventDefault();
                const pos = getCanvasPosition(e);
                setSelectionBox({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
              }
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedTool && paperRef.current) {
              const pos = getCanvasPosition(e);
              // Store position for drop
              (e as any).dropPosition = pos;
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedTool && (e as any).dropPosition) {
              const pos = (e as any).dropPosition;
              handleAddElement(draggedTool, pos.x, pos.y);
              setDraggedTool(null);
            }
          }}
        >
          <div
            ref={paperRef}
            key={`paper-${format}-${customWidth}-${customHeight}`}
            className="zd:relative zd:m-auto zd:bg-background"
            style={{
              width: `${pageDimensions?.width || 210}mm`,
              minHeight: `${dynamicPageHeight}mm`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              backgroundImage: showGrid
                ? `linear-gradient(to right, var(--muted) 1px, transparent 1px),
                   linear-gradient(to bottom, var(--muted) 1px, transparent 1px)`
                : "none",
              backgroundSize: showGrid ? `${snapSize}px ${snapSize}px` : "auto",
            }}
            onClick={(e) => {
              // Cancel anchor selection if clicking on canvas background
              if (selectingAnchorFor) {
                if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("zd:relative")) {
                  setSelectingAnchorFor(null);
                  setHoveredAnchorElementId(null);
                }
                return;
              }
              // Don't deselect if we just finished a selection box drag
              if (justFinishedSelection) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              // Deselect all if clicking on canvas background
              if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("zd:relative")) {
                setSelectedElements(new Set());
              }
            }}
          >
            {/* Guided Background */}
            {guidedBackgroundUrlRef.current && (
              <div
                className="zd:absolute zd:inset-0 zd:pointer-events-none zd:z-0"
                style={{
                  backgroundImage: `url(${guidedBackgroundUrlRef.current})`,
                  backgroundSize: "100% 100%",
                  backgroundPosition: "top left",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.3,
                }}
              />
            )}
            
            {/* Selection box */}
            {selectionBox && (
              <div
                className="zd:absolute zd:ring-1 zd:ring-blue-500 zd:bg-blue-500/20 zd:pointer-events-none zd:z-[101]"
                style={{
                  left: `${Math.min(selectionBox.startX, selectionBox.endX)}px`,
                  top: `${Math.min(selectionBox.startY, selectionBox.endY)}px`,
                  width: `${Math.abs(selectionBox.endX - selectionBox.startX)}px`,
                  height: `${Math.abs(selectionBox.endY - selectionBox.startY)}px`,
                }}
              />
            )}

            {/* Page break dividers */}
            {pageBreakPositions.map((y, index) => (
              <div
                key={`page-break-${index}`}
                className="zd:absolute zd:left-0 zd:right-0 zd:pointer-events-none zd:z-[50]"
                style={{
                  top: `${y}mm`,
                  height: '2px',
                  background: 'repeating-linear-gradient(to right, #ef4444 0px, #ef4444 10px, transparent 10px, transparent 20px)',
                  borderTop: '1px dashed #ef4444',
                  borderBottom: '1px dashed #ef4444',
                }}
              >
                <div
                  className="zd:absolute zd:left-0 zd:top-1/2 zd:-translate-y-1/2 zd:bg-red-500 zd:text-white zd:text-xs zd:px-2 zd:py-0.5 zd:rounded-r zd:font-medium"
                  style={{ fontSize: '10px' }}
                >
                  {t("Page Break")} {index + 2}
                </div>
              </div>
            ))}

            {layout.length === 0 && (
              <div className="zd:absolute zd:inset-0 zd:flex zd:items-center zd:justify-center zd:text-muted-foreground zd:text-center zd:p-8">
                <div>
                  <p className="zd:text-lg zd:mb-2">{t("Click tools below to add components")}</p>
                  <p className="zd:text-sm">{t("Drag to move - Drag corners to resize - Drag on empty area to select multiple")}</p>
                </div>
              </div>
            )}
            {layout.map((element, index) => renderElement(element, index))}
          </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Toolbar - Tools */}
      {!readonly && (
        <div className="zd:fixed zd:bottom-4 zd:left-1/2 zd:-translate-x-1/2 zd:z-50 zd:bg-background zd:border zd:border-border zd:rounded zd:shadow-lg zd:px-2 zd:py-1.5 zd:flex zd:items-center zd:gap-1">
          {TOOLS.map((tool) => (
            <Button
              key={tool.type}
              variant={draggedTool === tool.type ? "solid" : "ghost"}
              size="sm"
              onClick={() => handleAddElement(tool.type)}
              draggable={!readonly}
              onDragStart={() => setDraggedTool(tool.type)}
              onDragEnd={() => setDraggedTool(null)}
              title={tool.label}
            >
              <tool.icon className="zd:w-4 zd:h-4" />
              <span>{tool.label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Right Sidebar - Properties */}
      {!readonly && showSidebar && (
        <div className="zd:w-[420px] zd:flex-shrink-0 zd:border-l zd:border-border zd:bg-background zd:flex zd:flex-col zd:overflow-hidden">
          <div className="zd:px-4 zd:py-2.5 zd:border-b zd:border-border zd:bg-muted/50 zd:flex zd:items-center zd:justify-between">
            <h3 className="zd:text-sm zd:font-semibold">{t("Customize")}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(false)}
              title={t("Hide Sidebar")}
            >
              <X className="zd:w-4 zd:h-4" />
            </Button>
          </div>
          <div className="zd:flex-1 zd:overflow-y-auto zd:p-4 zd:space-y-4">
          {selectedElements.size > 0 ? (
            selectedElements.size > 1 ? (
              // Multiple elements selected - show bulk actions
              <div className="zd:space-y-3">
                <div className="zd:space-y-1">
                  <label className="zd:text-sm zd:font-medium">{t("Selected Elements")}</label>
                  <div className="zd:text-xs zd:text-muted-foreground">
                    {selectedElements.size} {selectedElements.size === 1 ? t("element") : t("elements")} {t("selected")}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="zd:w-full"
                  onClick={() => {
                    if (readonly) return;
                    // Delete all selected elements at once
                    const idsToDelete = Array.from(selectedElements);
                    const newLayout = layout.filter((el) => !idsToDelete.includes(el.id));
                    onChange(newLayout);
                    addToHistory(newLayout);
                    setSelectedElements(new Set());
                  }}
                >
                  <X className="zd:w-4 zd:h-4" />
                  <span>{t("Delete")} {selectedElements.size} {selectedElements.size === 1 ? t("Element") : t("Elements")}</span>
                </Button>
              </div>
            ) : (
              // Single element selected - show customization
              Array.from(selectedElements).map((id) => {
                const element = layout.find((el) => el.id === id);
                if (!element) return null;
                
                const mergeStyleUpdate = (styleUpdates: Partial<PrintTemplateElement["style"]> = {}) => {
                  const newStyle = { ...(element.style || {}) };
                  Object.entries(styleUpdates as Record<string, any>).forEach(([key, value]) => {
                    if (value === undefined || value === null || value === "") {
                      delete (newStyle as any)[key];
                    } else {
                      (newStyle as any)[key] = value;
                    }
                  });
                  handleUpdateElement(id, { style: newStyle });
                };
                
                const currentStyle = element.style || {};
                // Check if it's a reference table field
                const isReferenceTableField = element.type === "field" && selectedFieldConfig?.type === "Reference Table";
                const isTextualElement = element.type === "text" || element.type === "field" || element.type === "reference" || isReferenceTableField;
                
                const toggleDecoration = (decoration: "underline" | "line-through") => {
                  const parts = new Set((currentStyle.textDecoration || "").split(" ").filter(Boolean));
                  if (parts.has(decoration)) {
                    parts.delete(decoration);
                  } else {
                    parts.add(decoration);
                  }
                  const next = Array.from(parts).join(" ");
                  mergeStyleUpdate({ textDecoration: next || undefined });
                };

              return (
                <div key={id} className="zd:space-y-3">
                <div className="zd:space-y-1">
                  <label className="zd:text-sm zd:font-medium">{t("Type")}</label>
                  <div className="zd:text-xs zd:text-muted-foreground zd:capitalize">{element.type}</div>
                </div>

                {element.type === "field" && (
                  <>
                    <div className="zd:space-y-1">
                      <label className="zd:text-sm zd:font-medium">{t("Field")}</label>
                      <Select
                        value={typeof element.value === "string" ? element.value : ""}
                        onChange={(value) => handleUpdateElement(id, { value, fields: [] })}
                        options={[
                          { value: "", label: t("Select Field") },
                          ...fieldOptions.filter(opt => opt.value && opt.label).map(opt => ({ 
                            value: opt.value || "", 
                            label: opt.label || opt.value || "" 
                          })),
                        ]}
                      />
                    </div>
                    {selectedFieldConfig && selectedFieldConfig.type === "Reference Table" && (
                      <>
                        <div className="zd:space-y-1 zd:border-t zd:border-border zd:pt-3">
                          <label className="zd:text-sm zd:font-medium">{t("Table Settings")}</label>
                          <Tabs
                            tabs={[t("General"), t("Columns")]}
                            activeTab={tableSettingsTab === "general" ? t("General") : t("Columns")}
                            onTabChange={(label) => {
                              setTableSettingsTab(label === t("General") ? "general" : "columns");
                            }}
                            translate={false}
                          />
                        </div>
                        <TableCustomizationPanel
                          element={element}
                          id={id}
                          childFields={childFields}
                          handleUpdateElement={handleUpdateElement}
                          t={t}
                          selectedFieldConfig={selectedFieldConfig}
                          activeTab={tableSettingsTab}
                          onTabChange={(tab) => setTableSettingsTab(tab)}
                        />
                      </>
                    )}
                    <div className="zd:space-y-2">
                      <label className="zd:text-sm zd:font-medium">{t("Label")}</label>
                      <Input
                        value={element.label || ""}
                        onChange={(e) => handleUpdateElement(id, { label: e.target.value })}
                        placeholder={t("Optional label text")}
                      />
                    </div>
                    <div className="zd:space-y-2">
                      <label className="zd:text-sm zd:font-medium">{t("Label Position")}</label>
                      <Select
                        value={element.labelPosition || "left"}
                        onChange={(value) => handleUpdateElement(id, { labelPosition: value as any })}
                        options={[
                          { value: "left", label: t("Left") },
                          { value: "right", label: t("Right") },
                          { value: "top", label: t("Top") },
                          { value: "bottom", label: t("Bottom") },
                        ]}
                      />
                    </div>
                  </>
                )}

                {element.type === "text" && (
                  <div className="zd:space-y-1">
                    <label className="zd:text-sm zd:font-medium">{t("Text")}</label>
                    <Input
                      value={typeof element.value === "string" ? element.value : (element.value instanceof File ? element.value.name : "")}
                      onChange={(e) => handleUpdateElement(id, { value: e.target.value })}
                    />
                  </div>
                )}

                {element.type === "image" && (
                  <div className="zd:space-y-1">
                    <label className="zd:text-sm zd:font-medium">{t("Image")}</label>
                    <FormControl
                      field={{
                        type: "File",
                        name: "image",
                        doctype: "zodula__Print Template Item",
                        accept: "image/*",
                      }}
                      fieldKey="image"
                      value={element.value}
                      onChange={(fieldName, value) => {
                        handleUpdateElement(id, { value });
                      }}
                      docId={id}
                      hideFormControl={true}
                    />
                  </div>
                )}

                {element.type === "reference" && (
                  <>
                    <div className="zd:space-y-1">
                      <label className="zd:text-sm zd:font-medium">{t("Doctype")}</label>
                      <Select
                        value={element.referenceDoctype || ""}
                        onChange={(value) => handleUpdateElement(id, { referenceDoctype: value, referenceField: "" })}
                        options={[
                          { value: "", label: t("Select Doctype") },
                          ...doctypeOptions.filter((opt: { value: string; label: string }) => opt.value && opt.label).map((opt: { value: string; label: string }) => ({ 
                            value: opt.value || "", 
                            label: opt.label || opt.value || "" 
                          })),
                        ]}
                      />
                    </div>
                    {element.referenceDoctype && (
                      <>
                        <div className="zd:space-y-1">
                          <label className="zd:text-sm zd:font-medium">{t("ID Filter")}</label>
                          <Input
                            value={element.referenceIdFilter || ""}
                            onChange={(e) => handleUpdateElement(id, { referenceIdFilter: e.target.value })}
                            placeholder="{{session.organization}}"
                          />
                          <p className="zd:text-xs zd:text-muted-foreground zd:mt-1">
                            {t("Use {{session.*}}, {{doc.*}}, or {{zodula.*}} for dynamic values")}
                          </p>
                        </div>
                        <div className="zd:space-y-1">
                          <label className="zd:text-sm zd:font-medium">{t("Field")}</label>
                          <Select
                            value={element.referenceField || ""}
                            onChange={(value) => handleUpdateElement(id, { referenceField: value })}
                            options={[
                              { value: "", label: t("Select Field") },
                              ...referenceFieldOptions.filter((opt: { value: string; label: string }) => opt.value && opt.label).map((opt: { value: string; label: string }) => ({ 
                                value: opt.value || "", 
                                label: opt.label || opt.value || "" 
                              })),
                            ]}
                          />
                        </div>
                      </>
                    )}
                    <div className="zd:space-y-2">
                      <label className="zd:text-sm zd:font-medium">{t("Label")}</label>
                      <Input
                        value={element.label || ""}
                        onChange={(e) => handleUpdateElement(id, { label: e.target.value })}
                        placeholder={t("Optional label text")}
                      />
                    </div>
                    <div className="zd:space-y-2">
                      <label className="zd:text-sm zd:font-medium">{t("Label Position")}</label>
                      <Select
                        value={element.labelPosition || "left"}
                        onChange={(value) => handleUpdateElement(id, { labelPosition: value as any })}
                        options={[
                          { value: "left", label: t("Left") },
                          { value: "right", label: t("Right") },
                          { value: "top", label: t("Top") },
                          { value: "bottom", label: t("Bottom") },
                        ]}
                      />
                    </div>
                  </>
                )}

                {element.type === "custom_html" && (
                  <div className="zd:space-y-1">
                    <label className="zd:text-sm zd:font-medium">{t("Binba Template Code")}</label>
                    <Textarea
                      value={typeof element.value === "string" ? element.value : ""}
                      onChange={(e) => handleUpdateElement(id, { value: e.target.value })}
                      placeholder={t("Enter binba template code...")}
                      className="zd:min-h-[200px] zd:font-mono zd:text-xs"
                    />
                    <p className="zd:text-xs zd:text-muted-foreground zd:mt-1">
                      {t("Use binba template syntax for custom HTML rendering")}
                    </p>
                  </div>
                )}

                <div className="zd:space-y-1">
                  <label className="zd:text-sm zd:font-medium">{t("Horizontal Alignment")}</label>
                  <div className="zd:flex zd:gap-2">
                    <Button
                      variant={(element.align || "left") === "left" ? "solid" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateElement(id, { align: "left" })}
                      title="Left"
                    >
                      <AlignLeft className="zd:w-4 zd:h-4" />
                    </Button>
                    <Button
                      variant={element.align === "center" ? "solid" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateElement(id, { align: "center" })}
                      title="Center"
                    >
                      <AlignCenter className="zd:w-4 zd:h-4" />
                    </Button>
                    <Button
                      variant={element.align === "right" ? "solid" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateElement(id, { align: "right" })}
                      title="Right"
                    >
                      <AlignRight className="zd:w-4 zd:h-4" />
                    </Button>
                  </div>
                </div>

                <div className="zd:space-y-1">
                  <label className="zd:text-sm zd:font-medium">{t("Vertical Alignment")}</label>
                  <div className="zd:flex zd:gap-2">
                    <Button
                      variant={(element.verticalAlign || "middle") === "top" ? "solid" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateElement(id, { verticalAlign: "top" })}
                      title="Top"
                    >
                      <ArrowUp className="zd:w-4 zd:h-4" />
                    </Button>
                    <Button
                      variant={(element.verticalAlign || "middle") === "middle" ? "solid" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateElement(id, { verticalAlign: "middle" })}
                      title="Middle"
                    >
                      <Minus className="zd:w-4 zd:h-4" />
                    </Button>
                    <Button
                      variant={element.verticalAlign === "bottom" ? "solid" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateElement(id, { verticalAlign: "bottom" })}
                      title="Bottom"
                    >
                      <ArrowDown className="zd:w-4 zd:h-4" />
                    </Button>
                  </div>
                </div>

                {isTextualElement && (
                  <div className="zd:space-y-2">
                    <label className="zd:text-sm zd:font-medium">{t("Text Style")}</label>
                    <div className="zd:flex zd:items-center zd:gap-2">
                      <Input
                        type="number"
                        value={currentStyle.fontSize ?? ""}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          mergeStyleUpdate({ fontSize: Number.isFinite(value) && value > 0 ? value : undefined });
                        }}
                        placeholder={t("Font size")}
                        className="zd:w-24"
                      />
                      <span className="zd:text-xs zd:text-muted-foreground">px</span>
                    </div>
                    <div className="zd:flex zd:flex-wrap zd:gap-2">
                      <Button
                        variant={(currentStyle.fontWeight || "") === "bold" ? "solid" : "outline"}
                        size="sm"
                        onClick={() => mergeStyleUpdate({ fontWeight: currentStyle.fontWeight === "bold" ? undefined : "bold" })}
                        title={t("Bold")}
                      >
                        <Bold className="zd:w-4 zd:h-4" />
                      </Button>
                      <Button
                        variant={(currentStyle.fontStyle || "") === "italic" ? "solid" : "outline"}
                        size="sm"
                        onClick={() => mergeStyleUpdate({ fontStyle: currentStyle.fontStyle === "italic" ? undefined : "italic" })}
                        title={t("Italic")}
                      >
                        <Italic className="zd:w-4 zd:h-4" />
                      </Button>
                      <Button
                        variant={(currentStyle.textDecoration || "").split(" ").includes("underline") ? "solid" : "outline"}
                        size="sm"
                        onClick={() => toggleDecoration("underline")}
                        title={t("Underline")}
                      >
                        <Underline className="zd:w-4 zd:h-4" />
                      </Button>
                      <Button
                        variant={(currentStyle.textDecoration || "").split(" ").includes("line-through") ? "solid" : "outline"}
                        size="sm"
                        onClick={() => toggleDecoration("line-through")}
                        title={t("Strike-through")}
                      >
                        <Strikethrough className="zd:w-4 zd:h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {element.transform && (
                  <div className="zd:space-y-1">
                    <label className="zd:text-sm zd:font-medium">{t("Position & Size")}</label>
                    <div className="zd:grid zd:grid-cols-2 zd:gap-2">
                      <div>
                        <label className="zd:text-xs zd:text-muted-foreground">X</label>
                        <Input
                          type="number"
                          value={element.transform!.x}
                          onChange={(e) =>
                            handleUpdateElement(id, {
                              transform: {
                                ...element.transform!,
                                x: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="zd:text-xs zd:text-muted-foreground">Y</label>
                        <Input
                          type="number"
                          value={element.transform!.y}
                          onChange={(e) =>
                            handleUpdateElement(id, {
                              transform: {
                                ...element.transform!,
                                y: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="zd:text-xs zd:text-muted-foreground">Width</label>
                        <Input
                          type="number"
                          value={element.transform!.width}
                          onChange={(e) =>
                            handleUpdateElement(id, {
                              transform: {
                                ...element.transform!,
                                width: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="zd:text-xs zd:text-muted-foreground">Height</label>
                        <Input
                          type="number"
                          value={element.transform!.height}
                          onChange={(e) =>
                            handleUpdateElement(id, {
                              transform: {
                                ...element.transform!,
                                height: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Anchor Settings */}
                <div className="zd:space-y-1 zd:border-t zd:border-border zd:pt-3">
                  <label className="zd:text-sm zd:font-medium">{t("Anchor")}</label>
                  <div className="zd:space-y-2 zd:mt-2">
                    <div className="zd:space-y-1">
                      <label className="zd:text-xs zd:text-muted-foreground">{t("Anchor To")}</label>
                      <div className="zd:flex zd:gap-2">
                        <Select
                          value={element.anchorTo || ""}
                          onChange={(value) => {
                            if (value === "") {
                              handleUpdateElement(id, { 
                                anchorTo: null as any,
                                anchorPosition: null as any,
                                anchorOffset: null as any
                              });
                            } else {
                              // Check for loops before setting anchor
                              if (wouldCreateLoop(id, value, layout)) {
                                alert(t("Cannot anchor: This would create a circular dependency"));
                                return;
                              }
                              const currentOffset = typeof element.anchorOffset === "object" 
                                ? element.anchorOffset 
                                : { x: 0, y: typeof element.anchorOffset === "number" ? element.anchorOffset : 10 };
                              handleUpdateElement(id, { 
                                anchorTo: value,
                                anchorPosition: "top-left",
                                anchorOffset: currentOffset
                              });
                            }
                          }}
                          options={[
                            { value: "", label: t("None") },
                            ...layout
                              .filter(el => el.id !== id) // Exclude self
                              .map(el => ({
                                value: el.code || el.id, // Use code (preferred) or id (fallback)
                                label: `${el.type === "anchor" ? "📍 " : ""}${el.type}${typeof el.value === "string" && el.value ? `: ${el.value.substring(0, 20)}` : ""}${el.code ? ` (${el.code})` : ` (${el.id.substring(0, 8)}...)`}`,
                              }))
                          ]}
                          className="zd:flex-1"
                        />
                          <Button
                          variant={selectingAnchorFor === id ? "solid" : "outline"}
                            size="sm"
                            onClick={() => {
                            if (selectingAnchorFor === id) {
                              setSelectingAnchorFor(null);
                              setHoveredAnchorElementId(null);
                            } else {
                              setSelectingAnchorFor(id);
                              setHoveredAnchorElementId(null);
                            }
                            }}
                          title={t("Click on canvas to select anchor")}
                          >
                          <Eye className="zd:w-4 zd:h-4" />
                          </Button>
                      </div>
                      {selectingAnchorFor === id && (
                        <p className="zd:text-xs zd:text-muted-foreground zd:italic">
                          {t("Click on an element in the canvas to anchor to it")}
                        </p>
                      )}
                    </div>
                    
                    {element.anchorTo && element.anchorTo !== null && (
                      <>
                        <div className="zd:space-y-1">
                          <label className="zd:text-xs zd:text-muted-foreground">{t("Position")}</label>
                          <p className="zd:text-xs zd:text-muted-foreground zd:italic">
                            {t("Top-Left (relative to anchor's top-left corner)")}
                          </p>
                        </div>
                        
                        <div className="zd:space-y-1">
                          <label className="zd:text-xs zd:text-muted-foreground">{t("Offset (px)")}</label>
                          <div className="zd:grid zd:grid-cols-2 zd:gap-2">
                            <div>
                              <label className="zd:text-xs zd:text-muted-foreground">X</label>
                          <Input
                            type="number"
                                value={typeof element.anchorOffset === "object" ? element.anchorOffset.x : 0}
                                onChange={(e) => {
                                  const currentOffset = typeof element.anchorOffset === "object" ? element.anchorOffset : { x: 0, y: typeof element.anchorOffset === "number" ? element.anchorOffset : 0 };
                                  handleUpdateElement(id, { anchorOffset: { x: Number(e.target.value) || 0, y: currentOffset.y } });
                                }}
                              />
                            </div>
                            <div>
                              <label className="zd:text-xs zd:text-muted-foreground">Y</label>
                              <Input
                                type="number"
                                value={typeof element.anchorOffset === "object" ? element.anchorOffset.y : (typeof element.anchorOffset === "number" ? element.anchorOffset : 0)}
                                onChange={(e) => {
                                  const currentOffset = typeof element.anchorOffset === "object" ? element.anchorOffset : { x: 0, y: typeof element.anchorOffset === "number" ? element.anchorOffset : 0 };
                                  handleUpdateElement(id, { anchorOffset: { x: currentOffset.x, y: Number(e.target.value) || 0 } });
                                }}
                              />
                            </div>
                          </div>
                          <p className="zd:text-xs zd:text-muted-foreground zd:mt-1">
                            {t("Distance from anchored element (X and Y offsets)")}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
            })
            )
          ) : (
            <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:h-full zd:text-center zd:text-muted-foreground">
              <p className="zd:text-sm">{t("Select an element to edit")}</p>
              <p className="zd:text-xs zd:mt-2">{t("Hold Ctrl and click to select multiple")}</p>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

