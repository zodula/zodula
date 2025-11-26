import { Button, Input } from "zodula-ui"
import { SidebarLayout } from "@/zodula/ui/layout/sidebar-layout"
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout"
import { WorkspaceList } from "@/zodula/ui/components/workspace/workspace-list"
import { WorkspaceView } from "@/zodula/ui/components/workspace/workspace-view"
import { useWorkspace, useWorkspaceEdit, type WorkspaceWithChildren } from "@/zodula/ui/components/workspace/use-workspace"
import { cn } from "@/zodula/ui/lib/utils"
import { confirm } from "@/zodula/ui/components/ui/popit"
import { useMemo } from "react"
import { useTranslation } from "@/zodula/ui/hooks/use-translation"

export default function adminPage() {
    const { t } = useTranslation()
    const { selectedWorkspace, reloadWorkspaces, reloadWorkspaceItems } = useWorkspace()
    const { editedWorkspaceItems, editedWorkspaces, isEditing, setIsEditing, saveEdit, discardEdit, hasChanges } = useWorkspaceEdit()

    // Helper function to find workspace in hierarchy
    const findWorkspaceInHierarchy = (workspaces: WorkspaceWithChildren[], workspaceId: string): WorkspaceWithChildren | null => {
        for (const workspace of workspaces) {
            if (workspace.id === workspaceId) {
                return workspace;
            }
            if (workspace.children.length > 0) {
                const found = findWorkspaceInHierarchy(workspace.children, workspaceId);
                if (found) return found;
            }
        }
        return null;
    };

    // Get current workspace (edited or original)
    const currentWorkspace = useMemo(() => {
        if (!selectedWorkspace) return null;
        if (isEditing) {
            // Find the edited version of the selected workspace in hierarchy
            return findWorkspaceInHierarchy(editedWorkspaces, selectedWorkspace.id) || selectedWorkspace;
        }
        return selectedWorkspace;
    }, [isEditing, selectedWorkspace, editedWorkspaces]);

    const handleCancelEdit = async () => {
        if (hasChanges()) {
            const confirmed = await confirm({
                title: "Discard Changes",
                message: "You have unsaved changes. Are you sure you want to discard them?",
                confirmText: "Discard",
                cancelText: "Keep Editing",
                variant: "destructive"
            })
            if (confirmed) {
                discardEdit()
            }
        } else {
            discardEdit()
        }
    }

    const handleToggleEdit = async () => {
        if (isEditing) {
            await handleCancelEdit()
        } else {
            setIsEditing(true)
        }
    }

    return <NavbarLayout>
        <SidebarLayout
            defaultOpen={true}
            title={t(currentWorkspace?.name || "")}
            actionSection={<div className="zd:flex zd:items-center zd:gap-2">
                <Button onClick={handleToggleEdit} variant="subtle">
                    {isEditing ? t("Cancel") : t("Edit")}
                </Button>
                <Button onClick={saveEdit} className={cn(isEditing ? "" : "zd:hidden")}>
                    {t("Save")}
                </Button>
            </div>}
            sidebarContent={
                <div>
                    <WorkspaceList />
                </div>
            }>
            <WorkspaceView />
        </SidebarLayout>
    </NavbarLayout>
}