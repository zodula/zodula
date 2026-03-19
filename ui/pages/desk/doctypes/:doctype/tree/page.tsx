import { useRouter } from "@/zodula/ui/components/router";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout, type PrimaryAction } from "@/zodula/ui/layout/sidebar-layout";
import { TreeView } from "@/zodula/ui/components/list/TreeView";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { Plus, RefreshCw } from "lucide-react";
import { ViewSelector, getDoctypeViewOptions, findSelfReferentialField, type FieldLike } from "@/zodula/ui/components/view-selector";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodula } from "@/zodula/client";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import ErrorView from "@/zodula/ui/views/error-view";
import { QuickEntryDialog } from "@/zodula/ui/components/dialogs/quick-entry-dialog";
import LoadingView from "@/zodula/ui/views/loading-view";

function buildTree<T extends Record<string, any>>(
  docs: T[],
  parentField: string
): { doc: T; children: any[] }[] {
  const map = new Map<string, { doc: T; children: { doc: T; children: any[] }[] }>();
  docs.forEach((doc) => {
    map.set(doc.id, { doc, children: [] });
  });

  const roots: { doc: T; children: any[] }[] = [];
  docs.forEach((doc) => {
    const node = map.get(doc.id)!;
    const parentId = doc[parentField];
    if (parentId) {
      const parent = map.get(parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const sortByDisplay = (a: { doc: T }, b: { doc: T }) => {
    const ak = a.doc.id ?? "";
    const bk = b.doc.id ?? "";
    return ak.localeCompare(bk);
  };
  const sortRecursive = (nodes: { doc: T; children: any[] }[]) => {
    nodes.sort(sortByDisplay);
    nodes.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

export default function DoctypeTreePage() {
  const { params, push, location } = useRouter();
  const doctype = params.doctype as Zodula.DoctypeName;
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { docs: allFields } = useDocListAll({ doctype: "Field" });
  const { doc: doctypeDoc, reload: reloadDoctype } = useDocAll({
    doctype: "Doctype",
    id: doctype,
  });
  const { docs, loading, error, reload } = useDocListAll({
    doctype,
    forceRefetch: false,
  });

  const fields = useMemo(
    () =>
      allFields
        .filter((f) => (f as any).doctype === doctype)
        .sort((a, b) => ((a as any).idx ?? 0) - ((b as any).idx ?? 0)),
    [allFields, doctype]
  );

  const parentField = useMemo(
    () => findSelfReferentialField(fields as { doctype: string; name: string; type: string; reference?: string }[], doctype),
    [fields, doctype]
  );

  const treeNodes = useMemo(() => {
    if (!parentField || !docs.length) return [];
    return buildTree(docs, parentField);
  }, [docs, parentField]);

  const displayField = doctypeDoc?.display_field || "id";
  const displayFieldLabel = useMemo(() => {
    const f = fields.find((x: any) => x.name === displayField);
    return f?.label || displayField;
  }, [fields, displayField]);

  const treeColumns = useMemo(() => {
    return (fields as any[])
      .filter((f) => f.in_tree_view === 1)
      .map((f) => ({ key: f.name, label: f.label || f.name }));
  }, [fields]);

  const renderCell = useCallback(
    (doc: Record<string, any>, key: string) => {
      const field = (fields as any[]).find((f) => f.name === key);
      const value = doc[key];
      if (value == null) return "-";
      if (field?.type === "Currency" || field?.type === "Float") {
        const num = typeof value === "number" ? value : parseFloat(String(value));
        return isNaN(num) ? String(value) : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return String(value);
    },
    [fields]
  );

  useEffect(() => {
    reloadDoctype();
  }, [doctype]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    reload();
    await new Promise((r) => setTimeout(r, 50));
    setIsRefreshing(false);
  };

  const handleCreate = () => {
    const isQuickEntry = doctypeDoc?.is_quick_entry === 1;
    if (isQuickEntry) {
      // QuickEntryDialog would need to be called - simplified for now
      push(`/desk/doctypes/${doctype}/form`, { state: { resetForm: true } });
    } else {
      push(`/desk/doctypes/${doctype}/form`, { state: { resetForm: true } });
    }
  };

  const handleRowClick = (doc: Record<string, any>) => {
    push(`/desk/doctypes/${doctype}/form/${doc.id}`);
  };

  const primaryActions: PrimaryAction[] = [
    { label: t("Create"), icon: <Plus className="zd:h-4 zd:w-4" />, onClick: handleCreate },
    {
      label: "",
      icon: <RefreshCw className="zd:h-4 zd:w-4" />,
      onClick: handleRefresh,
      variant: "outline",
      disabled: isRefreshing,
    },
  ];

  if (!doctypeDoc?.id) {
    return <ErrorView message="Doctype not found" status={404} />;
  }

  if (!parentField) {
    return (
      <ErrorView
        message={t("Tree view requires a self-referential field (Reference to same doctype). This doctype has no such field.")}
        status={400}
      />
    );
  }

  return (
    <NavbarLayout>
      <SidebarLayout
        title={t(`${doctypeDoc?.label || doctype}`)}
        defaultOpen={false}
        primaryAction={primaryActions}
        actionSection={
          <ViewSelector
            views={getDoctypeViewOptions(t, fields as FieldLike[], doctype)}
            value="tree"
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
        <div className="zd:relative">
          <TreeView
            nodes={treeNodes}
            displayField={displayField}
            displayLabel={displayFieldLabel}
            getDocId={(doc) => doc.id}
            columns={treeColumns}
            renderCell={renderCell}
            onRowClick={handleRowClick}
            className={loading ? "zd:opacity-60 zd:pointer-events-none" : ""}
          />
          {loading && (
            <div className="zd:absolute zd:inset-0 zd:flex zd:items-center zd:justify-center zd:bg-background/50">
              <LoadingView />
            </div>
          )}
          {error && (
            <div className="zd:p-4 zd:text-destructive zd:text-sm">{error}</div>
          )}
        </div>
      </SidebarLayout>
    </NavbarLayout>
  );
}
