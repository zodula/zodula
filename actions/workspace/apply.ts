import { z } from "bxo"

interface WorkspaceData {
    id?: string
    name: string
    idx?: number | null
    workspace_parent?: string | null
    icon?: string | null
    url?: string | null
    workspace_roles?: Array<{ role?: string | null }>
    app?: string | null
    is_system?: number | null
}

const isTempId = (id: string | undefined): boolean => {
    if (!id) return true
    return id.startsWith('temp_') || id.startsWith('temp-')
}

export default $action(async (ctx) => {
    const { workspaces, export_fixtures = true } = ctx.body

    const hasRoles = await $zodula.session.hasRoles(["System Admin"])
    if (!hasRoles) {
        return ctx.json({
            success: false,
            error: "Unauthorized"
        }, 403)
    }

    try {
        const workspaceToUpdate: Array<{ id: string, data: WorkspaceData }> = []
        const workspaceToDelete: string[] = []

        for (const workspace of workspaces) {
            if (isTempId(workspace.id)) {
                continue
            }
            if (workspace._deleted) {
                if (workspace.id) {
                    workspaceToDelete.push(workspace.id)
                }
            } else {
                if (workspace.id) {
                    workspaceToUpdate.push({
                        id: workspace.id,
                        data: {
                            name: workspace.name,
                            idx: workspace.idx ?? 0,
                            workspace_parent: workspace.workspace_parent || null,
                            icon: workspace.icon || null,
                            url: workspace.url || null,
                            workspace_roles: workspace.workspace_roles || [],
                            app: workspace.app || "zodula",
                            is_system: workspace.is_system || 0
                        }
                    })
                }
            }
        }

        for (const workspaceId of workspaceToDelete) {
            await $zodula.doctype("Workspace").delete(workspaceId).bypass(true)
        }

        const createdWorkspaces: Array<{ id: string, tempId?: string }> = []
        const workspaceIdMap = new Map<string, string>()
        const tempWorkspaces = workspaces.filter(ws => isTempId(ws.id))

        type PendingWorkspaceCreate = { tempId: string; data: WorkspaceData }
        const pendingWorkspaceCreates: PendingWorkspaceCreate[] = tempWorkspaces.map((ws) => ({
            tempId: ws.id!,
            data: {
                name: ws.name,
                idx: ws.idx ?? 0,
                workspace_parent: ws.workspace_parent || null,
                icon: ws.icon || null,
                url: ws.url || null,
                workspace_roles: ws.workspace_roles || [],
                app: ws.app || "zodula",
                is_system: ws.is_system || 0
            }
        }))

        const canCreateWorkspace = (entry: PendingWorkspaceCreate): boolean => {
            const p = entry.data.workspace_parent
            if (!p) return true
            if (!isTempId(p)) return true
            return workspaceIdMap.has(p)
        }

        while (pendingWorkspaceCreates.length > 0) {
            const idx = pendingWorkspaceCreates.findIndex(canCreateWorkspace)
            if (idx === -1) {
                return ctx.json({
                    success: false,
                    error: "Invalid workspace hierarchy: unresolved parent workspace references (check temp vs saved order)."
                }, 400)
            }
            const entry = pendingWorkspaceCreates.splice(idx, 1)[0]!
            const rawParent = entry.data.workspace_parent
            let resolvedParent: string | null = null
            if (rawParent) {
                resolvedParent = isTempId(rawParent)
                    ? (workspaceIdMap.get(rawParent) ?? null)
                    : rawParent
            }
            if (rawParent && isTempId(rawParent) && resolvedParent == null) {
                return ctx.json({
                    success: false,
                    error: "Invalid workspace hierarchy: parent workspace was not created."
                }, 400)
            }

            const created = await $zodula.doctype("Workspace").insert({
                name: entry.data.name,
                idx: entry.data.idx ?? 0,
                workspace_parent: resolvedParent,
                icon: entry.data.icon || null,
                url: entry.data.url || null,
                workspace_roles: entry.data.workspace_roles || [],
                app: entry.data.app || "zodula",
                is_system: (entry.data.is_system === 1 ? 1 : 0) as 0 | 1
            } as any).bypass(true)

            if (created) {
                workspaceIdMap.set(entry.tempId, created.id)
                createdWorkspaces.push({ id: created.id, tempId: entry.tempId })
            }
        }

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

        for (const { id, data } of workspaceToUpdate) {
            await $zodula.doctype("Workspace").update(id, {
                name: data.name,
                idx: data.idx ?? 0,
                workspace_parent: data.workspace_parent || null,
                icon: data.icon || null,
                url: data.url || null,
                workspace_roles: data.workspace_roles || [],
                app: data.app || "zodula",
                is_system: (data.is_system === 1 ? 1 : 0) as 0 | 1
            } as any).bypass(true)
        }

        if (export_fixtures && process.env.ZODULA_PUBLIC_DEVELOPER_MODE == "true") {
            try {
                const actionLoader = $loader.from("action")
                const exportAction = actionLoader.get("zodula.fixtures.exports") || actionLoader.get("zodula.fixtures.exports")
                if (exportAction) {
                    const workspaceFields = ["id", "name", "idx", "workspace_parent", "icon", "url", "workspace_roles", "app", "is_system"]

                    const touchedApps = new Set<string>()
                    for (const w of workspaces) {
                        if (w.app) touchedApps.add(w.app)
                    }
                    for (const c of createdWorkspaces) {
                        const appName = workspaceIdToApp.get(c.id)
                        if (appName) touchedApps.add(appName)
                    }

                    for (const appName of touchedApps) {
                        const existing = await $zodula
                            .doctype("Workspace")
                            .select()
                            .where("app", "=", appName)
                            .fields(["id"])
                            .bypass(true)
                        const allWorkspaceIds = (existing.docs || []).map((d: any) => d.id).filter(Boolean)
                        await exportAction.handler({
                            ...ctx,
                            body: {
                                app: appName,
                                doctype: "Workspace",
                                ids: allWorkspaceIds,
                                fields: workspaceFields
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
            url: z.string().nullable().optional(),
            workspace_roles: z.array(z.object({
                id: z.string().optional(),
                role: z.string().nullable().optional(),
                idx: z.number().nullable().optional(),
                parentid: z.string().optional(),
                parentype: z.string().nullable().optional(),
                parentfield: z.string().nullable().optional(),
            })).optional(),
            app: z.string().nullable().optional(),
            is_system: z.number().nullable().optional(),
            _deleted: z.boolean().optional(),
        })),
        export_fixtures: z.boolean().optional(),
    }),
})
