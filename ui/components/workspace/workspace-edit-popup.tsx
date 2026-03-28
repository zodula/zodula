import { useMemo, useState } from "react"
import { GripVertical, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { zodula } from "@/zodula/client"
import { useDnd } from "@/zodula/ui/hooks/use-dnd"
import { useDocListAllStore } from "@/zodula/ui/hooks/use-doc-list-all"
import { Button } from "@/zodula/ui/components/ui/button"
import { Input } from "@/zodula/ui/components/ui/input"
import { FormControl } from "@/zodula/ui/components/ui/form-control"
import { popup } from "@/zodula/ui/components/ui/popit"
import { cn } from "@/zodula/ui/lib/utils"
import { WorkspaceIconPicker } from "@/zodula/ui/components/workspace/workspace-icon-picker"
import { WorkspaceRolesEditorPopup } from "@/zodula/ui/components/workspace/workspace-roles-editor-popup"

type WorkspaceRow = {
  id: string
  name: string
  url?: string | null
  icon?: string | null
  app?: string | null
  workspace_roles?: Array<{ id?: string; role?: string | null }>
  is_system?: number | null
  workspace_parent?: string | null
  idx?: number | null
}

interface WorkspaceEditPopupProps {
  isOpen: boolean
  onClose: (result?: boolean) => void
  initialData?: {
    workspaces?: WorkspaceRow[]
    selectedRootId?: string | null
    mode?: "root" | "child"
  }
}

/** Pixels per hierarchy level for tree guides + content offset. */
const TREE_LEVEL_PX = 26

const createTempWorkspace = (): WorkspaceRow => {
  const stamp = Date.now().toString(36)
  return {
    id: `temp_workspace_${stamp}`,
    name: "",
    url: null,
    icon: "Folder",
    app: "zodula",
    workspace_roles: [],
    is_system: 0,
    workspace_parent: null,
    idx: 0,
  }
}

export function WorkspaceEditPopup({ isOpen: _isOpen, onClose, initialData }: WorkspaceEditPopupProps) {
  const mode = initialData?.mode || "root"
  const initialRows = useMemo(
    () =>
      [...(initialData?.workspaces || [])].sort(
        (a, b) => (a.idx || 0) - (b.idx || 0)
      ),
    [initialData?.workspaces]
  )
  const [rows, setRows] = useState<WorkspaceRow[]>(initialRows)
  const [deletedRows, setDeletedRows] = useState<WorkspaceRow[]>([])
  const [selectedRootId, setSelectedRootId] = useState<string | null>(initialData?.selectedRootId || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roots = useMemo(
    () =>
      rows
        .filter((row) => !row.workspace_parent),
    [rows]
  )

  const activeRootId = useMemo(() => {
    if (selectedRootId && roots.some((root) => root.id === selectedRootId)) return selectedRootId
    return roots[0]?.id || null
  }, [roots, selectedRootId])

  /** Depth-first list of all descendants under the selected root (for multi-level editing). */
  const flatSubtree = useMemo((): Array<{ row: WorkspaceRow; depth: number }> => {
    if (mode !== "child" || !activeRootId) return []
    const walk = (parentId: string, depth: number): Array<{ row: WorkspaceRow; depth: number }> => {
      const next = rows
        .filter((r) => r.workspace_parent === parentId)
        .sort((a, b) => (a.idx || 0) - (b.idx || 0))
      const out: Array<{ row: WorkspaceRow; depth: number }> = []
      for (const row of next) {
        out.push({ row, depth })
        out.push(...walk(row.id, depth + 1))
      }
      return out
    }
    return walk(activeRootId, 0)
  }, [mode, rows, activeRootId])

  /** Names from immediate parent up to (not including) selected root — shows "Under A › B" for nested items. */
  const ancestorNamesUnderRoot = useMemo(() => {
    const m = new Map<string, string[]>()
    if (!activeRootId) return m
    for (const row of rows) {
      if (!row.workspace_parent) continue
      const chain: string[] = []
      let pid: string | null | undefined = row.workspace_parent
      while (pid && pid !== activeRootId) {
        const p = rows.find((r) => r.id === pid)
        if (!p) break
        chain.unshift(p.name || p.id)
        pid = p.workspace_parent ?? null
      }
      m.set(row.id, chain)
    }
    return m
  }, [rows, activeRootId])

  const reorderByGroup = (
    list: WorkspaceRow[],
    fromId: string,
    toId: string,
    type: "before" | "after"
  ): WorkspaceRow[] => {
    const fromIndex = list.findIndex((w) => w.id === fromId)
    const toIndex = list.findIndex((w) => w.id === toId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list

    const next = [...list]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return list
    const targetIndex = next.findIndex((w) => w.id === toId)
    const insertIndex = type === "before" ? targetIndex : targetIndex + 1
    next.splice(insertIndex, 0, moved)
    return next
  }

  const reorderRootRows = (fromId: string, toId: string, type: "before" | "after") => {
    setRows((prev) => {
      const prevRoots = prev.filter((row) => !row.workspace_parent)
      const prevChildren = prev.filter((row) => row.workspace_parent)
      const nextRoots = reorderByGroup(prevRoots, fromId, toId, type)
      return [...nextRoots, ...prevChildren]
    })
  }

  /** Reorder only among siblings (same workspace_parent). */
  const reorderChildRows = (fromId: string, toId: string, type: "before" | "after") => {
    setRows((prev) => {
      const fromRow = prev.find((r) => r.id === fromId)
      const toRow = prev.find((r) => r.id === toId)
      if (!fromRow || !toRow) return prev
      if (fromRow.workspace_parent !== toRow.workspace_parent) return prev
      const parentId = fromRow.workspace_parent
      const sameParentChildren = prev.filter((row) => row.workspace_parent === parentId)
      const otherRows = prev.filter((row) => row.workspace_parent !== parentId)
      const nextChildren = reorderByGroup(sameParentChildren, fromId, toId, type)
      return [...otherRows, ...nextChildren]
    })
  }

  const rootDnd = useDnd({
    items: roots as any[],
    onReorder: reorderRootRows,
  })

  const childDnd = useDnd({
    items: flatSubtree.map((f) => f.row) as any[],
    onReorder: reorderChildRows,
  })

  const updateRow = (id: string, patch: Partial<WorkspaceRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const openRolesEditor = async (workspaceId: string) => {
    const target = rows.find((row) => row.id === workspaceId)
    if (!target) return
    const result = await popup(
      WorkspaceRolesEditorPopup,
      {
        title: "Workspace Roles",
        description: "Assign one or more roles for this workspace.",
        width: "680px",
        maxWidth: "92vw",
      },
      {
        workspaceName: target.name,
        roles: target.workspace_roles || [],
      }
    )
    if (!result) return
    updateRow(workspaceId, { workspace_roles: result })
  }

  const collectDescendantIds = (workspaceId: string, allRows: WorkspaceRow[]): string[] => {
    const directChildren = allRows.filter((row) => row.workspace_parent === workspaceId)
    const childIds = directChildren.map((row) => row.id)
    const nested = childIds.flatMap((id) => collectDescendantIds(id, allRows))
    return [...childIds, ...nested]
  }

  const removeRow = (id: string) => {
    setRows((prev) => {
      const removeIds = new Set([id, ...collectDescendantIds(id, prev)])
      const toDelete = prev.filter((row) => removeIds.has(row.id) && !row.id.startsWith("temp_"))
      if (toDelete.length > 0) {
        setDeletedRows((old) => [...old, ...toDelete])
      }
      const next = prev.filter((row) => !removeIds.has(row.id))
      if (selectedRootId && removeIds.has(selectedRootId)) {
        const nextRoot = next.find((row) => !row.workspace_parent)
        setSelectedRootId(nextRoot?.id || null)
      }
      return next
    })
  }

  const addRootRow = () => {
    const workspace = createTempWorkspace()
    setRows((prev) => [...prev, workspace])
    setSelectedRootId(workspace.id)
  }

  const addChildUnder = (parentId: string) => {
    setRows((prev) => [
      ...prev,
      {
        ...createTempWorkspace(),
        workspace_parent: parentId,
      },
    ])
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const missingApp = rows.find((row) => !String(row.app || "").trim())
      if (missingApp) {
        setError(`App is required for workspace "${missingApp.name || missingApp.id}".`)
        setSaving(false)
        return
      }

      const rootOrdered = rows.filter((row) => !row.workspace_parent)
      const childOrdered = rows.filter((row) => row.workspace_parent)
      const idxMap = new Map<string, number>()
      rootOrdered.forEach((row, index) => idxMap.set(row.id, index * 10))
      const childGroups = new Map<string, WorkspaceRow[]>()
      for (const child of childOrdered) {
        const parentId = child.workspace_parent || ""
        if (!childGroups.has(parentId)) childGroups.set(parentId, [])
        childGroups.get(parentId)!.push(child)
      }
      for (const group of childGroups.values()) {
        group.forEach((row, index) => idxMap.set(row.id, index * 10))
      }

      const workspaces = rows.map((row) => ({
        id: row.id,
        name: row.name.trim(),
        idx: idxMap.get(row.id) ?? 0,
        workspace_parent: row.workspace_parent || null,
        icon: row.icon || null,
        app: String(row.app || "").trim(),
        workspace_roles: row.workspace_roles || [],
        is_system: row.is_system || 0,
        url: row.url || null,
      }))

      for (const deleted of deletedRows) {
        workspaces.push({
          id: deleted.id,
          name: deleted.name,
          idx: deleted.idx || 0,
          workspace_parent: deleted.workspace_parent || null,
          icon: deleted.icon || null,
          app: String(deleted.app || "").trim(),
          workspace_roles: deleted.workspace_roles || [],
          is_system: deleted.is_system || 0,
          url: deleted.url || null,
          _deleted: true,
        })
      }

      const result = await zodula.action("zodula.workspace.apply", {
        data: {
          workspaces,
          export_fixtures: false,
        },
      })

      if (!result?.success) {
        throw new Error(result?.error || "Failed to save workspace changes")
      }

      useDocListAllStore.getState().triggerReload("Workspace")
      onClose(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save workspace changes")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="zd:flex zd:flex-col zd:gap-4">
      <div className="zd:flex zd:items-center zd:justify-between">
        <p className="zd:text-sm zd:text-muted-foreground">
          {mode === "root"
            ? "Edit root workspaces. Root edit does not include URL."
            : "Nested items are indented with tree guides. “Under …” shows the parent chain. Drag only reorders siblings."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={mode === "root" ? addRootRow : () => activeRootId && addChildUnder(activeRootId)}
          disabled={mode === "child" && !activeRootId}
        >
          <Plus className="zd:w-4 zd:h-4 zd:mr-1" />
          {mode === "root" ? "Add Root" : "Add Child"}
        </Button>
      </div>

      {mode === "root" ? (
        <div className="zd:border zd:border-border zd:rounded-md zd:overflow-hidden">
          <div className="zd:flex zd:items-center zd:justify-between zd:px-3 zd:py-2 zd:border-b zd:border-border zd:bg-muted/30">
            <p className="zd:text-sm zd:font-medium">Root Workspaces</p>
          </div>
          <div className="zd:max-h-[52vh] zd:overflow-y-auto">
            {roots.map((row, index) => {
              const dropProps = rootDnd.getDropZoneProps(index, row as any)
              const dragProps = rootDnd.getDragProps(row as any, index)
              return (
                <div
                  key={row.id}
                  {...dropProps}
                  className={cn(
                    "zd:flex zd:items-center zd:gap-2 zd:px-2 zd:py-2 zd:border-b zd:border-border last:zd:border-b-0",
                    dropProps.className
                  )}
                >
                  <button
                    type="button"
                    {...dragProps}
                    className={cn(
                      "zd:p-1 zd:text-muted-foreground hover:zd:text-foreground",
                      dragProps.className
                    )}
                    title="Drag to reorder"
                  >
                    <GripVertical className="zd:w-4 zd:h-4" />
                  </button>
                  <WorkspaceIconPicker
                    selectedIcon={row.icon || "Folder"}
                    onIconSelect={(iconName) => updateRow(row.id, { icon: iconName })}
                    size="small"
                    variant="compact"
                  />
                  <Input
                    value={row.name || ""}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    placeholder="Root workspace name"
                    className="zd:flex-1"
                  />
                  <div className="zd:w-44">
                    <FormControl
                      hideFormControl
                      fieldKey={`app-${row.id}`}
                      value={row.app || ""}
                      onChange={(_key, value) => updateRow(row.id, { app: value || null })}
                      field={{
                        type: "Reference",
                        reference: "App",
                        label: "App",
                      }}
                      docId={row.id}
                    />
                  </div>
                  <div className="zd:w-56">
                    <Button
                      variant="outline"
                      size="sm"
                      className="zd:w-full zd:justify-start"
                      onClick={() => openRolesEditor(row.id)}
                    >
                      <ShieldCheck className="zd:w-4 zd:h-4 zd:mr-1" />
                      Roles ({(row.workspace_roles || []).length})
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="zd:text-destructive hover:zd:text-destructive"
                    onClick={() => removeRow(row.id)}
                    title="Remove workspace"
                  >
                    <Trash2 className="zd:w-4 zd:h-4" />
                  </Button>
                </div>
              )
            })}
            {roots.length === 0 && (
              <div className="zd:px-3 zd:py-6 zd:text-sm zd:text-muted-foreground">
                No root workspace yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="zd:border zd:border-border zd:rounded-md zd:overflow-hidden">
          <div className="zd:flex zd:flex-col zd:gap-2 zd:px-3 zd:py-2 zd:border-b zd:border-border zd:bg-muted/30">
            <div className="zd:flex zd:items-center zd:justify-between zd:gap-2">
              <p className="zd:text-sm zd:font-medium">Child Workspaces</p>
              <div className="zd:min-w-52">
                <select
                  className="zd:w-full zd:h-8 zd:px-2 zd:text-sm zd:border zd:border-border zd:rounded-md zd:bg-background"
                  value={activeRootId || ""}
                  onChange={(e) => {
                    const v = e.target.value || null
                    setSelectedRootId(v)
                  }}
                >
                  {roots.map((root) => (
                    <option key={root.id} value={root.id}>
                      {root.name || root.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {activeRootId && (
              <p className="zd:text-xs zd:text-muted-foreground">
                Tree under:{" "}
                <span className="zd:font-medium zd:text-foreground">
                  {roots.find((r) => r.id === activeRootId)?.name || activeRootId}
                </span>
              </p>
            )}
          </div>
          <div className="zd:max-h-[52vh] zd:overflow-y-auto zd:bg-muted/20">
            {flatSubtree.map(({ row, depth }, index) => {
              const dropProps = childDnd.getDropZoneProps(index, row as any)
              const dragProps = childDnd.getDragProps(row as any, index)
              const ancestors = ancestorNamesUnderRoot.get(row.id) || []
              const pathLabel = ancestors.length > 0 ? ancestors.join(" › ") : null
              const contentPad = 10 + depth * TREE_LEVEL_PX
              return (
                <div
                  key={row.id}
                  {...dropProps}
                  className={cn(
                    "zd:relative zd:border-b zd:border-border last:zd:border-b-0",
                    depth > 0 && "zd:bg-background/80",
                    dropProps.className
                  )}
                >
                  {depth > 0 && (
                    <div
                      className="zd:pointer-events-none zd:absolute zd:inset-y-0 zd:left-0 zd:flex zd:bg-muted/25"
                      style={{ width: depth * TREE_LEVEL_PX }}
                      aria-hidden
                    >
                      {Array.from({ length: depth }).map((_, i) => (
                        <div
                          key={i}
                          className="zd:box-border zd:h-full zd:border-r zd:border-muted-foreground/35"
                          style={{ width: TREE_LEVEL_PX }}
                        />
                      ))}
                    </div>
                  )}
                  <div
                    className="zd:relative zd:z-[1] zd:flex zd:flex-col zd:gap-1.5 zd:py-2.5 zd:pr-2"
                    style={{ paddingLeft: contentPad }}
                  >
                    {pathLabel && (
                      <p
                        className="zd:text-[11px] zd:leading-tight zd:text-muted-foreground zd:truncate zd:pl-0.5"
                        title={pathLabel}
                      >
                        <span className="zd:font-medium zd:text-foreground/70">Under</span>{" "}
                        {ancestors.map((name, i) => (
                          <span key={`${row.id}-a-${i}`}>
                            {i > 0 && <span className="zd:mx-0.5 zd:text-muted-foreground/60">›</span>}
                            {name}
                          </span>
                        ))}
                      </p>
                    )}
                    <div className="zd:flex zd:min-w-0 zd:flex-wrap zd:items-center zd:gap-2">
                      <button
                        type="button"
                        {...dragProps}
                        className={cn(
                          "zd:shrink-0 zd:p-1 zd:text-muted-foreground hover:zd:text-foreground",
                          dragProps.className
                        )}
                        title="Drag to reorder (same parent only)"
                      >
                        <GripVertical className="zd:w-4 zd:h-4" />
                      </button>
                      <WorkspaceIconPicker
                        selectedIcon={row.icon || "Folder"}
                        onIconSelect={(iconName) => updateRow(row.id, { icon: iconName })}
                        size="small"
                        variant="compact"
                      />
                      <Input
                        value={row.name || ""}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Workspace name"
                        className="zd:min-w-[120px] zd:flex-1"
                      />
                      <div className="zd:w-40 zd:min-w-[7rem]">
                        <FormControl
                          hideFormControl
                          fieldKey={`app-${row.id}`}
                          value={row.app || ""}
                          onChange={(_key, value) => updateRow(row.id, { app: value || null })}
                          field={{
                            type: "Reference",
                            reference: "App",
                            label: "App",
                          }}
                          docId={row.id}
                        />
                      </div>
                      <div className="zd:w-52 zd:min-w-[10rem]">
                        <Button
                          variant="outline"
                          size="sm"
                          className="zd:w-full zd:justify-start"
                          onClick={() => openRolesEditor(row.id)}
                        >
                          <ShieldCheck className="zd:w-4 zd:h-4 zd:mr-1" />
                          Roles ({(row.workspace_roles || []).length})
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="zd:shrink-0 zd:text-destructive hover:zd:text-destructive"
                        onClick={() => removeRow(row.id)}
                        title="Remove workspace"
                      >
                        <Trash2 className="zd:w-4 zd:h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="zd:shrink-0 zd:px-2"
                        onClick={() => addChildUnder(row.id)}
                        title="Add child under this workspace"
                      >
                        <Plus className="zd:w-4 zd:h-4" />
                      </Button>
                    </div>
                    <Input
                      value={row.url || ""}
                      onChange={(e) => updateRow(row.id, { url: e.target.value || null })}
                      placeholder="URL path — e.g. /desk/..."
                      className="zd:h-8 zd:text-xs zd:font-mono zd:text-muted-foreground"
                    />
                  </div>
                </div>
              )
            })}
            {flatSubtree.length === 0 && (
              <div className="zd:px-3 zd:py-6 zd:text-sm zd:text-muted-foreground">
                {activeRootId ? "No child workspace under this root yet." : "Select a root workspace first."}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="zd:text-sm zd:text-destructive">{error}</p>}

      <div className="zd:flex zd:justify-end zd:gap-2">
        <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  )
}
