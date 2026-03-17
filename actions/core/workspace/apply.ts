import { z } from "bxo"

interface WorkspaceData {
    id?: string
    name: string
    idx?: number | null
    workspace_parent?: string | null
    icon?: string | null
    app?: string | null
    is_system?: number | null
}

interface WorkspaceItemData {
    id?: string
    idx?: number | null
    type?: string | null
    value?: string | null
    label?: string | null
    url?: string | null
    html?: string | null
    text?: string | null
    filters?: string | null
    heading_level?: string | null
    badge_variant?: string | null
    parentid: string
    parentype?: string | null
    parentfield?: string | null
    _deleted?: boolean
}

// Helper function to check if an ID is temporary
const isTempId = (id: string | undefined): boolean => {
    if (!id) return true
    return id.startsWith('temp_') || id.startsWith('temp-')
}

// Flatten workspace_items from all workspaces for processing (each item has parentid from its workspace)
function flattenWorkspaceItems(workspaces: Array<{ id?: string; workspace_items?: any[] }>): WorkspaceItemData[] {
    const items: WorkspaceItemData[] = []
    for (const ws of workspaces) {
        const parentid = ws.id ?? ""
        for (const item of ws.workspace_items ?? []) {
            items.push({
                ...item,
                parentid: item.parentid ?? parentid,
                parentype: item.parentype ?? "Workspace",
                parentfield: item.parentfield ?? "workspace_items",
            } as WorkspaceItemData)
        }
    }
    return items
}

export default $action(async (ctx) => {
    const { workspaces } = ctx.body
    const workspaceItems = flattenWorkspaceItems(workspaces)

    const hasRoles = await $zodula.session.hasRoles(["System Admin"])
    if (!hasRoles) {
        return ctx.json({
            success: false,
            error: "Unauthorized"
        }, 403)
    }

    try {
        // Process workspaces
        const workspaceToCreate: WorkspaceData[] = []
        const workspaceToUpdate: Array<{ id: string, data: WorkspaceData }> = []
        const workspaceToDelete: string[] = []

        for (const workspace of workspaces) {
            if (isTempId(workspace.id)) {
                // New workspace - will be created
                workspaceToCreate.push({
                    name: workspace.name,
                    idx: workspace.idx ?? 0,
                    workspace_parent: workspace.workspace_parent || null,
                    icon: workspace.icon || null,
                    app: workspace.app || "zodula",
                    is_system: workspace.is_system || 0
                })
            } else if (workspace._deleted) {
                // Workspace to delete
                if (workspace.id) {
                    workspaceToDelete.push(workspace.id)
                }
            } else {
                // Existing workspace to update
                if (workspace.id) {
                    workspaceToUpdate.push({
                        id: workspace.id,
                        data: {
                            name: workspace.name,
                            idx: workspace.idx ?? 0,
                            workspace_parent: workspace.workspace_parent || null,
                            icon: workspace.icon || null,
                            app: workspace.app || "zodula",
                            is_system: workspace.is_system || 0
                        }
                    })
                }
            }
        }

        // Process workspace items
        const itemToCreate: WorkspaceItemData[] = []
        const itemToUpdate: Array<{ id: string, data: WorkspaceItemData }> = []
        const itemToDelete: string[] = []

        for (const item of workspaceItems) {
            if (isTempId(item.id)) {
                // New item - will be created
                itemToCreate.push({
                    idx: item.idx ?? 0,
                    type: item.type || null,
                    value: item.value || null,
                    label: item.label ?? null,
                    url: item.url ?? null,
                    html: item.html ?? null,
                    text: item.text ?? null,
                    filters: item.filters ?? null,
                    heading_level: item.heading_level ?? null,
                    badge_variant: item.badge_variant ?? null,
                    parentid: item.parentid,
                    parentype: item.parentype ?? "Workspace",
                    parentfield: item.parentfield ?? "workspace_items"
                })
            } else if (item._deleted) {
                // Item to delete
                if (item.id) {
                    itemToDelete.push(item.id)
                }
            } else {
                // Existing item to update
                if (item.id) {
                    itemToUpdate.push({
                        id: item.id,
                        data: {
                            idx: item.idx ?? 0,
                            type: item.type || null,
                            value: item.value || null,
                            label: item.label ?? null,
                            url: item.url ?? null,
                            html: item.html ?? null,
                            text: item.text ?? null,
                            filters: item.filters ?? null,
                            heading_level: item.heading_level ?? null,
                            badge_variant: item.badge_variant ?? null,
                            parentid: item.parentid,
                            parentype: item.parentype ?? "Workspace",
                            parentfield: item.parentfield ?? "workspace_items"
                        }
                    })
                }
            }
        }

        // Execute operations in order: delete, create, update
        // This ensures foreign key constraints are maintained

        // Delete workspace items first (they reference workspaces)
        for (const itemId of itemToDelete) {
            await $zodula.doctype("Workspace Item").delete(itemId).bypass(true)
        }

        // Delete workspaces
        for (const workspaceId of workspaceToDelete) {
            await $zodula.doctype("Workspace").delete(workspaceId).bypass(true)
        }

        // Create new workspaces
        const createdWorkspaces: Array<{ id: string, tempId?: string }> = []
        const workspaceIdMap = new Map<string, string>()
        
        // Find temp workspaces from the original array
        const tempWorkspaces = workspaces.filter(ws => isTempId(ws.id))
        
        for (let idx = 0; idx < workspaceToCreate.length; idx++) {
            const workspaceData = workspaceToCreate[idx]
            if (!workspaceData) continue
            
            // Try to match with temp workspace by index
            const tempId = idx < tempWorkspaces.length ? tempWorkspaces[idx]?.id : undefined
            
            const created = await $zodula.doctype("Workspace").insert({
                name: workspaceData.name,
                idx: workspaceData.idx ?? 0,
                workspace_parent: workspaceData.workspace_parent || null,
                icon: workspaceData.icon || null,
                app: workspaceData.app || "zodula",
                is_system: (workspaceData.is_system === 1 ? 1 : 0) as 0 | 1
            }).bypass(true)
            
            if (created) {
                if (tempId) {
                    workspaceIdMap.set(tempId, created.id)
                }
                createdWorkspaces.push({ id: created.id, tempId })
            }
        }

        // Build workspace id -> app for fixture export by app
        const workspaceIdToApp = new Map<string, string>()
        for (const w of workspaceToUpdate) {
            workspaceIdToApp.set(w.id, w.data.app || "zodula")
        }
        for (const w of workspaces) {
            if (w.id && !isTempId(w.id)) workspaceIdToApp.set(w.id, w.app || "zodula")
        }
        for (const c of createdWorkspaces) {
            const tempW = tempWorkspaces.find(t => t.id === c.tempId)
            workspaceIdToApp.set(c.id, tempW?.app || "zodula")
        }

        // Create workspace items (resolve temp parentid to created workspace id)
        const createdItems: string[] = []
        const createdItemApp = new Map<string, string>()
        for (const itemData of itemToCreate) {
            const parentid = workspaceIdMap.get(itemData.parentid) || itemData.parentid
            const created = await $zodula.doctype("Workspace Item").insert({
                idx: itemData.idx ?? 0,
                type: (itemData.type as any) || null,
                value: itemData.value || null,
                label: itemData.label ?? null,
                url: itemData.url ?? null,
                html: itemData.html ?? null,
                text: itemData.text ?? null,
                filters: itemData.filters ?? null,
                heading_level: itemData.heading_level ?? null,
                badge_variant: itemData.badge_variant ?? null,
                parentid,
                parentype: itemData.parentype ?? "Workspace",
                parentfield: itemData.parentfield ?? "workspace_items"
            } as any).bypass(true)
            if (created?.id) {
                createdItems.push(created.id)
                createdItemApp.set(created.id, workspaceIdToApp.get(parentid) || "zodula")
            }
        }

        // Update workspaces
        for (const { id, data } of workspaceToUpdate) {
            await $zodula.doctype("Workspace").update(id, {
                name: data.name,
                idx: data.idx ?? 0,
                workspace_parent: data.workspace_parent || null,
                icon: data.icon || null,
                app: data.app || "zodula",
                is_system: (data.is_system === 1 ? 1 : 0) as 0 | 1
            }).bypass(true)
        }

        // Update workspace items
        for (const { id, data } of itemToUpdate) {
            await $zodula.doctype("Workspace Item").update(id, {
                idx: data.idx ?? 0,
                type: (data.type as any) || null,
                value: data.value || null,
                label: data.label ?? null,
                url: data.url ?? null,
                html: data.html ?? null,
                text: data.text ?? null,
                filters: data.filters ?? null,
                heading_level: data.heading_level ?? null,
                badge_variant: data.badge_variant ?? null,
                parentid: data.parentid,
                parentype: data.parentype ?? "Workspace",
                parentfield: data.parentfield ?? "workspace_items"
            } as any).bypass(true)
        }

        // Export fixtures after applying workspace changes (only in developer mode)
        // Export by workspace app: Workspace uses app_field; Workspace Item is grouped by parent workspace app
        if (process.env.ZODULA_PUBLIC_DEVELOPER_MODE == "true") {
            try {
                const actionLoader = $loader.from("action")
                const exportAction = actionLoader.get("zodula.fixtures.exports") || actionLoader.get("zodula.fixtures.exports")
                if (exportAction) {
                    const allWorkspaceIds = [
                        ...workspaceToUpdate.map(w => w.id),
                        ...createdWorkspaces.map(w => w.id)
                    ].filter(Boolean) as string[]

                    const workspaceFields = ["id", "name", "idx", "workspace_parent", "icon", "app", "is_system"]
                    const itemFields = ["id", "idx", "type", "value", "label", "url", "html", "text", "filters", "heading_level", "badge_variant", "parentid", "parentype", "parentfield"]

                    // Export workspaces by app (each app gets its own Workspace.fixture.json)
                    if (allWorkspaceIds.length > 0) {
                        await exportAction.handler({
                            ...ctx,
                            body: {
                                doctype: "Workspace",
                                ids: allWorkspaceIds,
                                fields: workspaceFields,
                                app_field: "app"
                            }
                        })
                    }

                    // Group workspace item IDs by parent workspace app
                    const itemIdsByApp = new Map<string, string[]>()
                    for (const { id, data } of itemToUpdate) {
                        const app = workspaceIdToApp.get(data.parentid) || "zodula"
                        if (!itemIdsByApp.has(app)) itemIdsByApp.set(app, [])
                        itemIdsByApp.get(app)!.push(id)
                    }
                    for (const id of createdItems) {
                        const app = createdItemApp.get(id) || "zodula"
                        if (!itemIdsByApp.has(app)) itemIdsByApp.set(app, [])
                        itemIdsByApp.get(app)!.push(id)
                    }
                    for (const [appName, ids] of itemIdsByApp) {
                        if (ids.length === 0) continue
                        await exportAction.handler({
                            ...ctx,
                            body: {
                                app: appName,
                                doctype: "Workspace Item",
                                ids,
                                fields: itemFields
                            }
                        })
                    }
                }
            } catch (exportError: any) {
                console.error('Failed to export fixtures:', exportError)
            }
        }

        return ctx.json({
            success: true,
            createdWorkspaces
        })
    } catch (error: any) {
        console.error('Failed to apply workspace changes:', error)
        return ctx.json({
            success: false,
            error: error?.message || 'Failed to apply workspace changes'
        }, 500)
    }
}, {
    body: z.object({
        workspaces: z.array(z.object({
            id: z.string().optional(),
            name: z.string(),
            idx: z.number().nullable().optional(),
            workspace_parent: z.string().nullable().optional(),
            icon: z.string().nullable().optional(),
            app: z.string().nullable().optional(),
            is_system: z.number().nullable().optional(),
            _deleted: z.boolean().optional(),
            workspace_items: z.array(z.object({
                id: z.string().optional(),
                idx: z.number().nullable().optional(),
                type: z.string().nullable().optional(),
                value: z.string().nullable().optional(),
                label: z.string().nullable().optional(),
                url: z.string().nullable().optional(),
                html: z.string().nullable().optional(),
                text: z.string().nullable().optional(),
                filters: z.string().nullable().optional(),
                heading_level: z.string().nullable().optional(),
                badge_variant: z.string().nullable().optional(),
                parentid: z.string().optional(),
                parentype: z.string().nullable().optional(),
                parentfield: z.string().nullable().optional(),
                _deleted: z.boolean().optional()
            })).optional()
        }))
    }),
})

