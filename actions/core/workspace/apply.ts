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
    options?: string | null
    workspaceId: string
}

// Helper function to check if an ID is temporary
const isTempId = (id: string | undefined): boolean => {
    if (!id) return true
    return id.startsWith('temp_') || id.startsWith('temp-')
}

export default $action(async (ctx) => {
    const { workspaces, workspaceItems } = ctx.body

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
                    options: item.options || null,
                    workspaceId: item.workspaceId
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
                            options: item.options || null,
                            workspaceId: item.workspaceId
                        }
                    })
                }
            }
        }

        // Execute operations in order: delete, create, update
        // This ensures foreign key constraints are maintained

        // Delete workspace items first (they reference workspaces)
        for (const itemId of itemToDelete) {
            await $zodula.doctype("zodula__Workspace Item").delete(itemId).bypass(true)
        }

        // Delete workspaces
        for (const workspaceId of workspaceToDelete) {
            await $zodula.doctype("zodula__Workspace").delete(workspaceId).bypass(true)
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
            
            const created = await $zodula.doctype("zodula__Workspace").insert({
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

        // Create workspace items (with updated workspaceId if workspace was created)
        for (const itemData of itemToCreate) {
            const workspaceId = workspaceIdMap.get(itemData.workspaceId) || itemData.workspaceId
            await $zodula.doctype("zodula__Workspace Item").insert({
                idx: itemData.idx ?? 0,
                type: (itemData.type as any) || null,
                value: itemData.value || null,
                options: itemData.options || null,
                workspaceId: workspaceId
            }).bypass(true)
        }

        // Update workspaces
        for (const { id, data } of workspaceToUpdate) {
            await $zodula.doctype("zodula__Workspace").update(id, {
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
            await $zodula.doctype("zodula__Workspace Item").update(id, {
                idx: data.idx ?? 0,
                type: (data.type as any) || null,
                value: data.value || null,
                options: data.options || null,
                workspaceId: data.workspaceId
            }).bypass(true)
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
            _deleted: z.boolean().optional()
        })),
        workspaceItems: z.array(z.object({
            id: z.string().optional(),
            idx: z.number().nullable().optional(),
            type: z.string().nullable().optional(),
            value: z.string().nullable().optional(),
            options: z.string().nullable().optional(),
            workspaceId: z.string(),
            _deleted: z.boolean().optional()
        }))
    }),
})

