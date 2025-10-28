import { useRouter } from "@/zodula/ui/components/router";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout, type ActionItem, type PrimaryAction } from "@/zodula/ui/layout/sidebar-layout";
import { ListView } from "@/zodula/ui/components/list/ListView";
import { useListParams } from "@/zodula/ui/hooks/use-list-params";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDoc } from "@/zodula/ui/hooks/use-doc";
import { Plus, Printer, Download, X, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { confirm, popup } from "@/zodula/ui/components/ui/popit";
import { zodula } from "@/zodula/client";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { FixtureDialog } from "@/zodula/ui/components/dialogs/fixture-dialog";
import { toast } from "@/zodula/ui/components/ui/toast";
import { CSVDialog } from "@/zodula/ui/components/dialogs/csv-dialog";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import ErrorView from "@/zodula/ui/views/error-view";

export default function DoctypeListPage() {
    const { params, push, replace, search } = useRouter()
    const doctype = params.doctype as Zodula.DoctypeName
    const { roles } = useAuth()
    const { t } = useTranslation()
    const [isRefreshing, setIsRefreshing] = useState(false)
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
        setSelected
    } = useListParams();

    const {
        docs,
        count,
        loading,
        error,
        reload
    } = useDocList({ doctype, limit, sort, order, q, filters });

    const { docs: fields, reload: reloadFields } = useDocList({
        doctype: "zodula__Field",
        limit: 1000000,
        sort: "idx",
        order: "asc",
        q: "",
        filters: [
            ["doctype", "=", doctype]
        ]
    }, [doctype]);

    // Get doctype metadata to check if it's submittable
    const { doc: doctypeDoc, reload: reloadDoctype } = useDoc({
        doctype: "zodula__Doctype",
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
        reload()
    }, [doctype, search]);

    const columns = useMemo(() => {
        const displayFieldName = doctypeDoc?.display_field || "id";
        const displayField = fields.find((field) => field.name === displayFieldName);
        const _columns = fields.filter((field) => {
            return (field.in_list_view === 1 || field.required === 1) && field.name !== displayFieldName && !zodula.utils.isStandardField(field.name)
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
        reload();
        await new Promise(resolve => setTimeout(resolve, 3000));
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
        const { app: selectedApp, fields: selectedFields } = await popup(FixtureDialog, {
            title: `Export Fixtures for ${doctype}`,
            description: `Selected ${selected.size} item(s)`
        }, {
            doctype,
            selected: Array.from(selected)
        }) || {}
        if (selectedApp && selectedFields) {
            await zodula.action("zodula.fixtures.exports", {
                data: {
                    app: selectedApp,
                    doctype,
                    ids: Array.from(selected),
                    fields: selectedFields
                }
            })
            toast.success(`Fixtures exported to ${selectedApp}`)
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

    const primaryActions: PrimaryAction[] = [
        {
            label: t("Create"),
            icon: <Plus className="zd:h-4 zd:w-4" />,
            onClick: handleCreate
        },
        {
            label: t("Refresh"),
            // icon: <RefreshCw className={`zd:h-4 zd:w-4`} />,
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

    return <NavbarLayout>
        <SidebarLayout
            title={t(`${doctypeDoc?.label || doctype}`)}
            defaultOpen={false}
            primaryAction={primaryActions}
            actions={selected.size > 0 ? actions : []}
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