import { useRouter } from "@/zodula/ui/components/router";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout, type ActionItem, type PrimaryAction } from "@/zodula/ui/layout/sidebar-layout";
import { SheetView } from "@/zodula/ui/components/list/SheetView";
import { useListParams } from "@/zodula/ui/hooks/use-list-params";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { Plus, Printer, Download, X, Trash2, RefreshCw, List, Grid3x3, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/zodula/ui/components/ui/dropdown-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import { confirm, popup, prompt } from "@/zodula/ui/components/ui/popit";
import { zodula } from "@/zodula/client";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { FixtureDialog } from "@/zodula/ui/components/dialogs/fixture-dialog";
import { toast } from "@/zodula/ui/components/ui/toast";
import type { SheetViewExportHandle } from "@/zodula/ui/components/list/SheetView";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import ErrorView from "@/zodula/ui/views/error-view";
import { Button } from "@/zodula/ui/components/ui/button";
import { ViewSelector, getDoctypeViewOptions, type FieldLike } from "@/zodula/ui/components/view-selector";
import { Select } from "@/zodula/ui/components/ui/select";

export default function DoctypeSheetPage() {
    const { params, push, replace, search, location } = useRouter()
    const doctype = params.doctype as Zodula.DoctypeName
    const { roles } = useAuth()
    const { t } = useTranslation()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const sheetViewRef = useRef<SheetViewExportHandle | null>(null);
    const {
        updateSearchParams,
        limit,
        sort,
        order,
        q,
        filters,
        onLimitChange,
        onSort,
        onSortChange,
        onOrderChange,
        onSearch,
        onApplyFilters,
        onClearFilter,
        selected,
        setSelected
    } = useListParams();

    const selectedReportId = typeof search.report === "string" ? search.report : "";
    const [rows, setRows] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    const {
        docs: reportOptions,
    } = useDocList({
        doctype: "Report",
        limit: 1000,
        sort: "updated_at",
        order: "desc",
        filters: [["doctype", "=", doctype] as any],
    });

    const selectedReport = useMemo(() => {
        return reportOptions.find((report) => report.id === selectedReportId) || null;
    }, [reportOptions, selectedReportId]);

    const [reportEditBaseline, setReportEditBaseline] = useState<{
        reportId: string;
        sort: string | null;
        order: "asc" | "desc" | null;
        filters: any[];
        columns: string[];
    } | null>(null);
    const [sheetVisibleColumns, setSheetVisibleColumns] = useState<string[]>([]);

    useEffect(() => {
        if (!selectedReportId || !selectedReport || selectedReport.is_script === 1) {
            setReportEditBaseline(null);
            return;
        }

        // Only initialize baseline when report changes (or first load),
        // so edits to filters/sort/order/columns can be detected correctly.
        if (reportEditBaseline?.reportId === selectedReportId) {
            return;
        }

        let reportFilters: any[] = [];
        try {
            reportFilters = JSON.parse(selectedReport.default_filters || "[]");
        } catch {
            reportFilters = [];
        }

        const reportItems = ((selectedReport as any).report_items || []) as any[];
        const baselineColumns = reportItems
            .map((item) => String(item?.doctype_field || ""))
            .filter(Boolean);
        const actionColumns = (columns || []).map((col) => String(col?.key || "")).filter(Boolean);

        setReportEditBaseline({
            reportId: selectedReportId,
            sort: selectedReport.sort ?? "updated_at",
            order: (selectedReport.order as "asc" | "desc" | undefined) ?? "desc",
            filters: reportFilters,
            columns: baselineColumns.length > 0 ? baselineColumns : actionColumns,
        });
    }, [selectedReportId, selectedReport, columns, reportEditBaseline]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        zodula
            .action("zodula.report.get" as any, {
                data: {
                    doctype,
                    report: selectedReportId || undefined,
                    limit: limit || 20,
                    sort: sort || undefined,
                    order: order || undefined,
                    q: q || "",
                    filters: filters || [],
                },
            })
            .then((res) => {
                if (cancelled) return;
                setRows(res.rows || []);
                setColumns(res.columns || []);
                setCount(res.count || 0);
            })
            .catch((e: any) => {
                if (cancelled) return;
                setRows([]);
                setColumns([]);
                setCount(0);
                setError(e?.message || "Failed to load sheet data");
            })
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [doctype, selectedReportId, limit, sort, order, q, filters, reloadToken]);

    // Fetch all fields with persistent caching, then filter client-side
    const { docs: allFields, reload: reloadFields } = useDocListAll({
        doctype: "Field"
    });

    // Filter fields by doctype and sort by idx
    const fields = useMemo(() => {
        return allFields
            .filter((field) => field.doctype === doctype)
            .sort((a, b) => (a.idx || 0) - (b.idx || 0));
    }, [allFields, doctype]);

    // Get doctype metadata to check if it's submittable
    const { doc: doctypeDoc, reload: reloadDoctype } = useDocAll({
        doctype: "Doctype",
        id: doctype
    });

    useEffect(() => {
        if (doctypeDoc?.is_single) {
            replace(`/desk/doctypes/${doctype}`);
        }
    }, [doctypeDoc, replace, doctype]);

    useEffect(() => {
        reloadFields();
        reloadDoctype();
        setReloadToken((prev) => prev + 1);
    }, [doctype, search]);

    const isSubmittable = doctypeDoc?.is_submittable === 1;

    const handleCreate = () => {
        push(`/desk/doctypes/${doctype}/form`, {
            state: {
                resetForm: true
            }
        });
    };

    const handleRefresh = async () => {
        if (isRefreshing) {
            return;
        }
        setIsRefreshing(true);
        setReloadToken((prev) => prev + 1);
        await new Promise(resolve => setTimeout(resolve, 50));
        setIsRefreshing(false);
    };

    const handleExportCSV = () => {
        if (selected.size === 0) return;
        sheetViewRef.current?.exportCSV();
    };

    const handleCancel = async () => {
        if (selected.size === 0) {
            return;
        }
        const con = await confirm({
            title: "Cancel",
            message: `Are you sure you want to cancel ${selected.size} item(s)?`,
            variant: "destructive"
        });
        if (con) {
            // TODO: Implement cancel functionality for submittable doctypes
            for (const id of Array.from(selected)) {
                await zodula.doc.cancel_doc(doctype, id).catch((error) => { })
            }
            setSelected(new Set());
            setReloadToken((prev) => prev + 1);
        }
    };

    const handleExportFixtures = async () => {
        const result = await popup(FixtureDialog, {
            title: `Export Fixtures for ${doctype}`,
            description: `Selected ${selected.size} item(s)`
        }, {
            doctype,
            selected: Array.from(selected)
        }) || {}
        const { app: selectedApp, app_field: selectedAppField, fields: selectedFields } = result as { app: string, app_field: string, fields: string[] }
        if (selectedFields && (selectedApp || selectedAppField)) {
            await zodula.action("zodula.fixtures.exports", {
                data: {
                    ...(selectedApp ? { app: selectedApp } : {}),
                    ...(selectedAppField ? { app_field: selectedAppField } : {}),
                    doctype,
                    ids: Array.from(selected),
                    fields: selectedFields
                }
            })
            const exportTarget = selectedAppField ? `app field "${selectedAppField}"` : selectedApp
            toast.success(`Fixtures exported to ${exportTarget}`)
        }
    };

    const handleDelete = async () => {
        if (selected.size === 0) {
            return;
        }
        const con = await confirm({
            title: "Delete",
            message: `Are you sure you want to delete ${selected.size} item(s)?`,
            variant: "destructive"
        });
        if (con) {
            await zodula.doc.delete_docs(doctype, Array.from(selected));
            setSelected(new Set());
        }

        setReloadToken((prev) => prev + 1);
    };

    const handleSwitchToListView = () => {
        push(`/desk/doctypes/${doctype}/list${location.search}`);
    };

    const isScriptReport = selectedReport?.is_script === 1;
    const isQueryReport = !!selectedReport && !isScriptReport;
    const isReadonlySheet = isScriptReport;
    const hasQueryReportChanges = useMemo(() => {
        if (!isQueryReport || !reportEditBaseline || reportEditBaseline.reportId !== selectedReportId) {
            return false;
        }
        const currentFilters = JSON.stringify(filters || []);
        const baselineFilters = JSON.stringify(reportEditBaseline.filters || []);
        const currentColumns = JSON.stringify(
            (sheetVisibleColumns.length > 0 ? sheetVisibleColumns : (columns || []).map((col) => String(col?.key || "")))
                .filter(Boolean)
        );
        const baselineColumns = JSON.stringify((reportEditBaseline.columns || []).filter(Boolean));
        return (
            (sort ?? null) !== (reportEditBaseline.sort ?? null) ||
            (order ?? null) !== (reportEditBaseline.order ?? null) ||
            currentFilters !== baselineFilters ||
            currentColumns !== baselineColumns
        );
    }, [isQueryReport, reportEditBaseline, selectedReportId, sort, order, filters, sheetVisibleColumns, columns]);

    const primaryActions: PrimaryAction[] = [
        {
            label: t("Create"),
            icon: <Plus className="zd:h-4 zd:w-4" />,
            onClick: handleCreate,
            disabled: isReadonlySheet,
        },
        {
            label: "",
            icon: <RefreshCw className="zd:h-4 zd:w-4" />,
            onClick: handleRefresh,
            variant: "outline",
            disabled: isRefreshing
        }
    ];

    const actions: ActionItem[] = [
        {
            id: "export-csv",
            label: t("Export CSV"),
            icon: <Download className="zd:h-4 zd:w-4" />,
            onClick: handleExportCSV
        }
    ];

    // Add cancel action if doctype is submittable
    if (isSubmittable) {
        actions.push({
            id: "cancel",
            label: t("Cancel"),
            icon: <X className="zd:h-4 zd:w-4" />,
            onClick: handleCancel
        });
    }

    if (roles.includes("System Admin")) {
        actions.push({
            id: "export-fixtures",
            label: t("Export Fixtures"),
            icon: <Download className="zd:h-4 zd:w-4" />,
            onClick: handleExportFixtures
        });
    }

    // Add delete action
    actions.push({
        id: "delete",
        label: t("Delete"),
        icon: <Trash2 className="zd:h-4 zd:w-4" />,
        onClick: handleDelete,
        variant: "destructive"
    });

    if (!doctypeDoc?.id) {
        return <ErrorView message="Doctype not found" status={404} />
    }

    const setReportInUrl = (reportId: string) => {
        const params = new URLSearchParams(location.search);
        if (reportId) {
            params.set("report", reportId);
        } else {
            params.delete("report");
        }
        const query = params.toString();
        push(`/desk/doctypes/${doctype}/sheet${query ? `?${query}` : ""}`, { replace: true });
        setSelected(new Set());
    };

    return <NavbarLayout>
        <SidebarLayout
            title={t(`${doctypeDoc?.label || doctype}`)}
            defaultOpen={false}
            primaryAction={primaryActions}
            actions={selected.size > 0 && !isReadonlySheet ? actions : []}
            sidebarContent={
                <div className="zd:flex zd:flex-col zd:gap-3">
                    <div>
                        <div className="zd:text-sm zd:font-medium zd:mb-1">{t("Report")}</div>
                        <Select
                            options={[
                                { value: "", label: t("Default Sheet") },
                                ...reportOptions.map((report) => ({
                                    value: report.id,
                                    label: report.name || report.id,
                                    subtitle: report.is_script === 1 ? t("Script") : t("Query"),
                                })),
                            ]}
                            value={selectedReportId}
                            onChange={setReportInUrl}
                            displayMode="label"
                            clearable
                        />
                    </div>
                    <div className="zd:flex zd:gap-2 zd:flex-wrap zd:justify-end">
                    {isQueryReport && (
                        <Button
                            variant="solid"
                            disabled={!hasQueryReportChanges}
                            onClick={async () => {
                                if (!selectedReport) return;
                                const currentColumnKeys = (
                                    sheetVisibleColumns.length > 0
                                        ? sheetVisibleColumns
                                        : (columns || []).map((col) => String(col?.key || ""))
                                ).filter(Boolean);
                                const reportItems = currentColumnKeys
                                    .filter((fieldName) => !!fields.find((field) => field.name === fieldName))
                                    .map((fieldName, idx) => {
                                        const field = fields.find((f) => f.name === fieldName);
                                        const colFromReport = (columns || []).find((c) => String(c?.key) === fieldName);
                                        const sortable = colFromReport
                                            ? (colFromReport.sortable !== false ? 1 : 0)
                                            : (field?.type !== "Reference Table" && field?.type !== "Extend" ? 1 : 0);
                                        return {
                                            idx,
                                            doctype_field: fieldName,
                                            label: field?.label || fieldName,
                                            sortable,
                                        };
                                    });
                                await zodula.doc.update_doc("Report", selectedReport.id as any, {
                                    default_filters: JSON.stringify(filters || []),
                                    sort: sort || "updated_at",
                                    order: order || "desc",
                                    report_items: reportItems,
                                } as any).catch(() => { });
                                setReportEditBaseline({
                                    reportId: selectedReport.id as string,
                                    sort: sort ?? null,
                                    order: order ?? null,
                                    filters: filters || [],
                                    columns: currentColumnKeys,
                                });
                                toast?.success?.(t("Report saved"));
                            }}
                        >
                            {t("Save Report")}
                        </Button>
                    )}
                    {!selectedReport && (
                        <Button
                            variant="outline"
                            onClick={async () => {
                                const reportName = await prompt({
                                    title: t("Save as Report"),
                                    message: t("Enter report name"),
                                    placeholder: `${doctype} Sheet`,
                                    defaultValue: ``,
                                    required: true,
                                    confirmText: t("Save"),
                                });
                                if (!reportName) return;
                                const currentColumnKeys = (
                                    sheetVisibleColumns.length > 0
                                        ? sheetVisibleColumns
                                        : (columns || []).map((col) => String(col?.key || ""))
                                ).filter(Boolean);
                                const reportItems = currentColumnKeys
                                    .filter((fieldName) => !!fields.find((field) => field.name === fieldName))
                                    .map((fieldName, idx) => {
                                        const field = fields.find((f) => f.name === fieldName);
                                        const colFromReport = (columns || []).find((c) => String(c?.key) === fieldName);
                                        const sortable = colFromReport
                                            ? (colFromReport.sortable !== false ? 1 : 0)
                                            : (field?.type !== "Reference Table" && field?.type !== "Extend" ? 1 : 0);
                                        return {
                                            idx,
                                            doctype_field: fieldName,
                                            label: field?.label || fieldName,
                                            sortable,
                                        };
                                    });
                                const newReport = await zodula.doc.create_doc(
                                    "Report" as any,
                                    {
                                        name: reportName,
                                        doctype,
                                        is_script: 0,
                                        default_filters: JSON.stringify(filters || []),
                                        sort: sort || "updated_at",
                                        order: order || "desc",
                                        report_items: reportItems,
                                    } as any
                                ).catch(() => null);
                                if (newReport?.id) {
                                    setReportInUrl(newReport.id as string);
                                    toast?.success?.(t("Report created"));
                                }
                            }}
                        >
                            {t("Save as Report")}
                        </Button>
                    )}
                    {selectedReport && selectedReport.is_script !== 1 && (
                        <Button
                            variant="outline"
                            disabled={!hasQueryReportChanges}
                            onClick={() => {
                                if (!reportEditBaseline) return;
                                updateSearchParams({
                                    sort: reportEditBaseline.sort,
                                    order: reportEditBaseline.order,
                                    filters: reportEditBaseline.filters as any,
                                });
                                sheetViewRef.current?.setVisibleColumns(reportEditBaseline.columns || []);
                            }}
                        >
                            {t("Reset Report")}
                        </Button>
                    )}
                    </div>
                </div>
            }
            actionSection={
                <ViewSelector
                    views={getDoctypeViewOptions(t, fields as FieldLike[], doctype)}
                    value={
                        location.pathname.includes("/sheet")
                            ? "sheet"
                            : location.pathname.includes("/tree")
                              ? "tree"
                              : "list"
                    }
                    onChange={(value) => {
                        if (value === "list") {
                            push(`/desk/doctypes/${doctype}/list${location.search}`);
                        } else if (value === "tree") {
                            push(`/desk/doctypes/${doctype}/tree${location.search}`);
                        } else {
                            push(`/desk/doctypes/${doctype}/sheet${location.search}`);
                        }
                    }}
                />
            }
        >
            <SheetView
                ref={sheetViewRef}
                hideDocStatus={doctypeDoc?.is_submittable !== 1}
                doctype={doctype}
                columns={columns}
                docs={rows}
                count={count}
                loading={loading}
                error={error}
                limit={limit}
                sort={sort}
                order={order}
                searchQuery={q}
                fields={fields}
                filters={filters}
                onLimitChange={onLimitChange}
                onSort={onSort}
                onSortChange={onSortChange}
                onOrderChange={onOrderChange}
                onSearch={onSearch}
                onApplyFilters={onApplyFilters}
                onClearFilter={onClearFilter}
                selected={selected}
                setSelected={setSelected}
                hideToolbar={isScriptReport}
                readonly={isReadonlySheet}
                strictColumns={isScriptReport}
                stateKey={selectedReportId ? `${doctype}::${selectedReportId}` : doctype}
                onVisibleColumnsChange={setSheetVisibleColumns}
            />
        </SidebarLayout>
    </NavbarLayout>
}

