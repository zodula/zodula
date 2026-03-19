import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { Plus, Printer, Download, X, Trash2, RefreshCw, ChevronDown } from "lucide-react";
import { useRouter } from "@/zodula/ui/components/router";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout, type ActionItem, type PrimaryAction, type SecondaryAction } from "@/zodula/ui/layout/sidebar-layout";
import { ListView } from "@/zodula/ui/components/list/ListView";
import { useListParams } from "@/zodula/ui/hooks/use-list-params";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { confirm, popup } from "@/zodula/ui/components/ui/popit";
import { toast } from "@/zodula/ui/components/ui/toast";
import { ViewSelector, getDoctypeViewOptions, type FieldLike } from "@/zodula/ui/components/view-selector";
import { DynamicIcon } from "@/zodula/ui/components/ui/dynamic-icon";
import { FixtureDialog } from "@/zodula/ui/components/dialogs/fixture-dialog";
import { CSVDialog } from "@/zodula/ui/components/dialogs/csv-dialog";
import ErrorView from "@/zodula/ui/views/error-view";
import { QuickEntryDialog } from "@/zodula/ui/components/dialogs/quick-entry-dialog";
import { zodula } from "@/zodula/client";
import { useZui } from "@/zodula/ui";

export default function DoctypeListPage() {
    const { params, push, replace, search, location } = useRouter();
    const doctype = params.doctype as Zodula.DoctypeName;
    const { roles } = useAuth();
    const { t } = useTranslation();
    const zui = useZui();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const {
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
        setSelected,
    } = useListParams();

    const { docs, count, loading, error, reload } = useDocList({
        doctype,
        limit,
        sort,
        order,
        q,
        filters,
    });

    const docsRef = useRef(docs);
    const selectedRef = useRef(selected);
    const reloadRef = useRef(reload);
    const pushRef = useRef(push);
    docsRef.current = docs;
    selectedRef.current = selected;
    reloadRef.current = reload;
    pushRef.current = push;

    const { docs: allFields, reload: reloadFields } = useDocListAll({
        doctype: "Field",
    });

    const fields = useMemo(
        () =>
            allFields
                .filter((field) => field.doctype === doctype)
                .sort((a, b) => (a.idx || 0) - (b.idx || 0)),
        [allFields, doctype]
    );

    const { doc: doctypeDoc, reload: reloadDoctype } = useDocAll({
        doctype: "Doctype",
        id: doctype,
    });

    useEffect(() => {
        if (doctypeDoc?.is_single) {
            replace(`/desk/doctypes/${doctype}`);
        }
    }, [doctypeDoc, replace, doctype]);

    useEffect(() => {
        reloadFields();
        reloadDoctype();
        reload();
    }, [doctype, search, params]);

    // ----- ZUI list context & secondary actions -----
    const listContext = useMemo(
        () => ({
            doctype,
            list_data: docs,
            selected_rows: selected,
            set_selected_rows: setSelected,
            reload,
        }),
        [doctype, docs, selected, setSelected, reload]
    );

    const secondaryActions = useMemo((): SecondaryAction[] => {
        const listButtons =
            zui?._?.state?.ui_list_secondary_buttons?.filter(
                (b) => b.doctype === doctype
            ) ?? [];
        const visible = listButtons.filter(
            (b) =>
                !b.options?.condition ||
                b.options.condition(listContext as any)
        );
        return visible.map((b) => {
            const iconName = b.options?.icon ?? "MoreHorizontal";
            const IconComponent = (props: { className?: string }) => (
                <DynamicIcon
                    iconName={iconName}
                    className={props.className ?? "zd:w-4 zd:h-4"}
                />
            );
            return {
                label: b.label,
                icon: IconComponent,
                onClick: () => b.onClick(listContext as any),
            };
        });
    }, [
        doctype,
        listContext,
        zui?._?.state?.ui_list_secondary_buttons,
    ]);

    const columns = useMemo(() => {
        const displayFieldName = doctypeDoc?.display_field || "id";
        const displayField = fields.find((field) => field.name === displayFieldName);
        const _columns = fields.filter((field) => {
            return (field.in_list_view === 1) && field.name !== displayFieldName && (!zodula.utils.isStandardField(field.name))
        }
        ).map((field) => ({
            key: field.name,
            label: field.label || field.name,
            sortable: true,
        }))
        return [
            {
                key: displayFieldName,
                label: displayField?.label || displayFieldName,
                sortable: true,
            },
            ..._columns]
    }, [fields]);

    const isSubmittable = doctypeDoc?.is_submittable === 1;
    const isQuickEntry = doctypeDoc?.is_quick_entry === 1;

    const handleCreate = async () => {
        if (isQuickEntry) {
            const result = await popup(QuickEntryDialog, undefined, {
                doctype,
                fields: fields as any
            });
            if (result?.id) {
                setSelected(new Set());
                reload();
            }
            return;
        }
        const prefill: Record<string, any> = {};
        if (filters?.length) {
            for (const f of filters) {
                const [field, operator, value] = f;
                if (operator === "=" && value !== undefined && value !== null) {
                    prefill[field as string] = value;
                }
            }
        }
        push(`/desk/doctypes/${doctype}/form`, {
            state: {
                resetForm: true,
                ...(Object.keys(prefill).length ? { prefill } : {})
            }
        });
    };

    const handleRefresh = async () => {
        if (isRefreshing) {
            return;
        }
        setIsRefreshing(true);
        reload();
        await new Promise(resolve => setTimeout(resolve, 50));
        setIsRefreshing(false);
    };

    const handleExportCSV = async () => {
        // TODO: Implement CSV export functionality
        if (selected.size > 0) {
            const { fields: selectedFields } = await popup(CSVDialog, {
                title: `Export CSV for ${doctype}`,
                description: `Selected ${selected.size} item(s)`
            }, {
                doctype,
                selected: Array.from(selected)
            }) || {}
            if (selectedFields) {
                const res = await zodula.action("zodula.exports.csv", {
                    data: {
                        doctype,
                        ids: Array.from(selected),
                        fields: columns.map((column) => column.key)
                    }
                })
                const blob = new Blob([res], { type: "text/csv" })
                const link = document.createElement("a")
                link.href = URL.createObjectURL(blob)
                link.download = `${doctype}.csv`
                link.click()
            }
        }
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
            reload();
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

        reload();
    };

    const handleSwitchToSheetView = () => {
        push(`/desk/doctypes/${doctype}/sheet${location.search}`);
    };

    const handlePrint = () => {
        if (selected.size === 0) return;
        const ids = JSON.stringify(Array.from(selected));
        push(`/desk/print?doctype=${encodeURIComponent(doctype)}&ids=${encodeURIComponent(ids)}`);
    };

    const primaryActions: PrimaryAction[] = [
        {
            label: t("Create"),
            icon: <Plus className="zd:h-4 zd:w-4" />,
            onClick: handleCreate
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
            id: "print",
            label: t("Print"),
            icon: <Printer className="zd:h-4 zd:w-4" />,
            onClick: handlePrint
        },
        {
            id: "export-csv",
            label: t("Export CSV"),
            icon: <Download className="zd:h-4 zd:w-4" />,
            onClick: handleExportCSV
        }
    ];

    if (roles.includes("System Admin")) {
        actions.push({
            id: "export-fixtures",
            label: t("Export Fixtures"),
            icon: <Download className="zd:h-4 zd:w-4" />,
            onClick: handleExportFixtures
        });
    }

    // Add cancel action if doctype is submittable
    if (isSubmittable) {
        actions.push({
            id: "cancel",
            label: t("Cancel"),
            icon: <X className="zd:h-4 zd:w-4" />,
            onClick: handleCancel
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

    if (!doctypeDoc?.id && !loading) {
        return <ErrorView message="Doctype not found" status={404} />
    }

    return <NavbarLayout>
        <SidebarLayout
            title={t(`${doctypeDoc?.label || doctype}`)}
            defaultOpen={false}
            primaryAction={primaryActions}
            secondaryActions={secondaryActions}
            actions={selected.size > 0 ? actions : []}
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
            <ListView
                hideDocStatus={doctypeDoc?.is_submittable !== 1}
                doctype={doctype}
                columns={columns}
                docs={docs}
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
            />
        </SidebarLayout>
    </NavbarLayout>
}