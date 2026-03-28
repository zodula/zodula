import { useRouter } from "@/zodula/ui/components/router";
import { DeskNavbarLayout, type ActionItem, type PrimaryAction } from "@/zodula/ui/layout/desk-navbar-layout";
import { SheetView } from "@/zodula/ui/components/list/SheetView";
import { useListParams } from "@/zodula/ui/hooks/use-list-params";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { Plus, Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prompt } from "@/zodula/ui/components/ui/popit";
import { zodula } from "@/zodula/client";
import { toast } from "@/zodula/ui/components/ui/toast";
import type { SheetViewExportHandle } from "@/zodula/ui/components/list/SheetView";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import ErrorView from "@/zodula/ui/views/error-view";
import { Button } from "@/zodula/ui/components/ui/button";
import {
    ViewSelector,
    getDoctypeViewOptions,
    getDoctypeViewFromPath,
    type FieldLike,
} from "@/zodula/ui/components/view-selector";
import { Select } from "@/zodula/ui/components/ui/select";
import {
    isSheetColumnKeyValid,
    labelForSheetColumnKey,
} from "@/zodula/ui/components/list/sheet-field-utils";
import {
    sheetColumnFiltersToIFilters,
    type SheetColumnFilterState,
} from "@/zodula/ui/components/list/sheet-column-filters-to-ifilters";
import { useColumnSettingsStore } from "@/zodula/ui/hooks/use-column-settings";
import { useSheetViewStore } from "@/zodula/ui/hooks/use-sheet-view";

function downloadCsvBlob(blobPart: BlobPart, filename: string) {
    const blob = new Blob([blobPart], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

export default function DoctypeSheetPage() {
    const { params, push, replace, search, location } = useRouter()
    const doctype = params.doctype as Zodula.DoctypeName
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
    const sheetColumnSettingsKey = selectedReportId
        ? `${doctype}::${selectedReportId}`
        : doctype;
    const hasCustomSheetColumns = useColumnSettingsStore(
        (s) => s.hasCustomColumns[sheetColumnSettingsKey] ?? false
    );
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

    const { docs: calendarRows } = useDocList(
        {
            doctype: "Doctype Calendar",
            limit: 1,
            filters: [["doctype", "=", doctype] as any],
        },
        [doctype]
    );
    const calendarEnabled = calendarRows.length > 0;

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
    const [sheetColumnFilters, setSheetColumnFilters] = useState<SheetColumnFilterState>({});
    const [debouncedSheetColumnFilters, setDebouncedSheetColumnFilters] =
        useState<SheetColumnFilterState>({});

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSheetColumnFilters(sheetColumnFilters), 400);
        return () => clearTimeout(id);
    }, [sheetColumnFilters]);

    useEffect(() => {
        setSheetColumnFilters({});
        setDebouncedSheetColumnFilters({});
    }, [doctype, selectedReportId]);

    const mergedReportFilters = useMemo(() => {
        const extra = sheetColumnFiltersToIFilters(debouncedSheetColumnFilters);
        return [...(filters || []), ...extra];
    }, [filters, debouncedSheetColumnFilters]);

    useEffect(() => {
        if (!selectedReportId || !selectedReport || selectedReport.is_script === 1) {
            setReportEditBaseline(null);
            return;
        }

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
                    filters: mergedReportFilters,
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
    }, [doctype, selectedReportId, limit, sort, order, q, mergedReportFilters, reloadToken]);

    const { docs: allFields, reload: reloadFields } = useDocListAll({
        doctype: "Field"
    });

    const fields = useMemo(() => {
        return allFields
            .filter((field) => field.doctype === doctype)
            .sort((a, b) => (a.idx || 0) - (b.idx || 0));
    }, [allFields, doctype]);

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

    const isScriptReport = selectedReport?.is_script === 1;
    const isQueryReport = !!selectedReport && !isScriptReport;
    const isReadonlySheet = isScriptReport;

    const handleExportCSV = async () => {
        const payload = sheetViewRef.current?.getCsvExportPayload?.();
        if (!payload) {
            toast.error(t("No columns to export"));
            return;
        }
        if (payload.kind === "query") {
            if (payload.ids.length === 0) {
                toast.error(t("Select rows to export"));
                return;
            }
            const res = await zodula.action("zodula.exports.csv", {
                data: {
                    doctype,
                    ids: payload.ids,
                    fields: payload.fields,
                    headers: payload.headers,
                },
            });
            downloadCsvBlob(res as BlobPart, `${doctype}.csv`);
        } else {
            if (payload.rows.length === 0) {
                toast.error(t("No rows to export"));
                return;
            }
            const res = await zodula.action("zodula.exports.csv_raw", {
                data: {
                    columns: payload.columns,
                    rows: payload.rows,
                    filename: doctype,
                },
            });
            downloadCsvBlob(res as BlobPart, `${doctype}.csv`);
        }
        toast.success(t("CSV exported"));
    };

    const canResetDefaultSheet =
        !selectedReportId &&
        ((filters?.length ?? 0) > 0 ||
            String(q ?? "").trim().length > 0 ||
            (sort ?? "updated_at") !== "updated_at" ||
            (order ?? "desc") !== "desc" ||
            (limit != null && limit !== 20) ||
            Object.keys(sheetColumnFilters).length > 0 ||
            hasCustomSheetColumns);

    const handleResetDefaultSheet = () => {
        updateSearchParams({
            q: null,
            filters: null,
            sort: "updated_at",
            order: "desc",
            limit: null,
        });
        setSheetColumnFilters({});
        setDebouncedSheetColumnFilters({});
        sheetViewRef.current?.resetVisibleColumns();
        useSheetViewStore.getState().resetColumnConfigs(sheetColumnSettingsKey);
        useSheetViewStore.getState().resetAggregationConfig(sheetColumnSettingsKey);
        setSelected(new Set());
        toast.success(t("Sheet reset"));
    };

    const showExportCsvAction = isScriptReport ? rows.length > 0 : selected.size > 0;

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

    const exportCsvActions: ActionItem[] = [
        {
            id: "export-csv",
            label: t("Export CSV"),
            icon: <Download className="zd:h-4 zd:w-4" />,
            onClick: handleExportCSV
        }
    ];

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

    return <DeskNavbarLayout
        title={t(`${doctypeDoc?.label || doctype}`)}
        defaultRightOpen={false}
        primaryAction={primaryActions}
        actions={showExportCsvAction ? exportCsvActions : []}
        rightSidebar={
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
                                    .filter((fieldName) =>
                                        isSheetColumnKeyValid(fieldName, fields, allFields)
                                    )
                                    .map((fieldName, idx) => {
                                        const field = fields.find((f) => f.name === fieldName);
                                        const colFromReport = (columns || []).find(
                                            (c) => String(c?.key) === fieldName
                                        );
                                        const sortable =
                                            colFromReport != null
                                                ? (colFromReport.sortable !== false ? 1 : 0)
                                                : fieldName.includes(".")
                                                  ? 0
                                                  : field?.type !== "Reference Table" &&
                                                      field?.type !== "Extend"
                                                    ? 1
                                                    : 0;
                                        return {
                                            idx,
                                            doctype_field: fieldName,
                                            label: labelForSheetColumnKey(fieldName, fields, allFields),
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
                        <>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!canResetDefaultSheet}
                            onClick={handleResetDefaultSheet}
                        >
                            {t("Reset")}
                        </Button>
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
                                    .filter((fieldName) =>
                                        isSheetColumnKeyValid(fieldName, fields, allFields)
                                    )
                                    .map((fieldName, idx) => {
                                        const field = fields.find((f) => f.name === fieldName);
                                        const colFromReport = (columns || []).find(
                                            (c) => String(c?.key) === fieldName
                                        );
                                        const sortable =
                                            colFromReport != null
                                                ? (colFromReport.sortable !== false ? 1 : 0)
                                                : fieldName.includes(".")
                                                  ? 0
                                                  : field?.type !== "Reference Table" &&
                                                      field?.type !== "Extend"
                                                    ? 1
                                                    : 0;
                                        return {
                                            idx,
                                            doctype_field: fieldName,
                                            label: labelForSheetColumnKey(fieldName, fields, allFields),
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
                        </>
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
                    views={getDoctypeViewOptions(t, fields as FieldLike[], doctype, { calendarEnabled })}
                    value={getDoctypeViewFromPath(location.pathname)}
                    onChange={(value) => {
                        if (value === "list") {
                            push(`/desk/doctypes/${doctype}/list${location.search}`);
                        } else if (value === "tree") {
                            push(`/desk/doctypes/${doctype}/tree${location.search}`);
                        } else if (value === "calendar") {
                            push(`/desk/doctypes/${doctype}/calendar${location.search}`);
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
                columnFilters={sheetColumnFilters}
                onColumnFiltersChange={setSheetColumnFilters}
            />
    </DeskNavbarLayout>
}
