import React, { useState, useEffect, useMemo } from "react"
import * as LucideIcons from "lucide-react"
import { useWorkspace, useWorkspaceEdit, type WorkspaceWithChildren, type WorkspaceItem } from "./use-workspace"
import { useWorkspaceDnd } from "../../hooks/use-workspace-dnd"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog"
import { WorkspaceIconPicker } from "./workspace-icon-picker"
import { DynamicIcon, type IconName } from "../ui/dynamic-icon"
import { confirm } from "../ui/popit"
import { useTranslation } from "../../hooks/use-translation"

const EXPANDED_STORAGE_KEY = 'zodula-expanded-workspaces';

export const WorkspaceList = () => {
    const { t } = useTranslation()
    const { setSelectedWorkspace, selectedWorkspace, hierarchicalWorkspaces, workspaces, workspaceItems, reloadWorkspaceItems, reloadWorkspaces } = useWorkspace()
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set())
    const { editedWorkspaces, isEditing, reorderWorkspace, initializeEditMode, addWorkspace, updateWorkspace, deleteWorkspace, saveEdit } = useWorkspaceEdit()


    // Workspace settings dialog state
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
    const [selectedWorkspaceForEdit, setSelectedWorkspaceForEdit] = useState<WorkspaceWithChildren | null>(null)
    const [isCreatingNewWorkspace, setIsCreatingNewWorkspace] = useState(false)

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

    // Icon editing handler
    const handleIconSelect = (workspaceId: string, iconName: string) => {
        const workspace = findWorkspaceInHierarchy(editedWorkspaces, workspaceId);
        if (workspace) {
            updateWorkspace(workspaceId, { ...workspace, icon: iconName })
        } else {
            console.error('Workspace not found in editedWorkspaces!')
        }
    }

    // Use edited workspaces when editing, otherwise use hierarchical workspaces
    const workspacesToRender = useMemo(() => {
        if (isEditing) {
            // editedWorkspaces is already hierarchical, so we can use it directly
            return editedWorkspaces;
        } else {
            return hierarchicalWorkspaces;
        }
    }, [isEditing, editedWorkspaces, hierarchicalWorkspaces])

    // Flatten workspaces for drag and drop
    const flattenedWorkspaces = useMemo(() => {
        const flatten = (workspaces: WorkspaceWithChildren[], level = 0): Array<{ workspace: WorkspaceWithChildren, level: number }> => {
            const result: Array<{ workspace: WorkspaceWithChildren, level: number }> = []
            workspaces.forEach(workspace => {
                result.push({ workspace, level })
                if (workspace.children.length > 0) {
                    result.push(...flatten(workspace.children, level + 1))
                }
            })
            return result
        }
        return flatten(workspacesToRender)
    }, [workspacesToRender])

    // Reset editing state and initialize edit mode when hierarchical workspaces change
    useEffect(() => {
        // Always initialize edit mode, even when there are no workspaces
        // Reset editing state if we have no edited workspaces (fresh load)
        if (editedWorkspaces.length === 0) {
            // Flatten hierarchical workspaces to include all workspaces (including children)
            const flattenWorkspaces = (workspaces: WorkspaceWithChildren[]): WorkspaceWithChildren[] => {
                const result: WorkspaceWithChildren[] = [];
                const flatten = (ws: WorkspaceWithChildren[]) => {
                    ws.forEach(workspace => {
                        result.push(workspace);
                        if (workspace.children.length > 0) {
                            flatten(workspace.children);
                        }
                    });
                };
                flatten(workspaces);
                return result;
            };

            const allWorkspaces = flattenWorkspaces(hierarchicalWorkspaces);

            // Create original workspace items map from the flat workspaceItems
            const originalWorkspaceItems: Record<string, WorkspaceItem[]> = {};
            workspaceItems.forEach(item => {
                if (!originalWorkspaceItems[item.workspaceId]) {
                    originalWorkspaceItems[item.workspaceId] = [];
                }
                originalWorkspaceItems[item.workspaceId]!.push(item);
            });

            initializeEditMode(allWorkspaces, allWorkspaces, originalWorkspaceItems)
        }
    }, [hierarchicalWorkspaces, editedWorkspaces.length, initializeEditMode, workspaceItems, isEditing])

    // Drag and drop functionality
    const {
        getDropZoneProps,
        getDragProps,
        getDropIndicatorProps,
        isDragging
    } = useWorkspaceDnd({
        workspaces: flattenedWorkspaces,
        onReorder: reorderWorkspace,
        disabled: !isEditing,
        maxDepth: 5
    })

    // Load expanded workspaces from localStorage on mount
    useEffect(() => {
        try {
            const savedExpanded = localStorage.getItem(EXPANDED_STORAGE_KEY);
            if (savedExpanded) {
                const expandedArray = JSON.parse(savedExpanded) as string[];
                setExpandedWorkspaces(new Set(expandedArray));
            }
        } catch (error) {
            console.warn('Failed to restore expanded workspaces from localStorage:', error);
        }
    }, []);

    // Save expanded workspaces to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(expandedWorkspaces)));
        } catch (error) {
            console.warn('Failed to save expanded workspaces to localStorage:', error);
        }
    }, [expandedWorkspaces]);

    const toggleExpanded = (workspaceId: string) => {
        setExpandedWorkspaces(prev => {
            const newSet = new Set(prev)
            if (newSet.has(workspaceId)) {
                newSet.delete(workspaceId)
            } else {
                newSet.add(workspaceId)
            }
            return newSet
        })
    }

    // Workspace settings dialog handlers
    const handleOpenSettings = (workspace: WorkspaceWithChildren) => {
        setSelectedWorkspaceForEdit(workspace)
        setIsCreatingNewWorkspace(false)
        setSettingsDialogOpen(true)
    }

    const handleCloseSettings = () => {
        setSettingsDialogOpen(false)
        setSelectedWorkspaceForEdit(null)
        setIsCreatingNewWorkspace(false)
    }

    const handleApplySettings = async (updatedWorkspace: WorkspaceWithChildren) => {
        if (isCreatingNewWorkspace) {
            // Add new workspace
            addWorkspace(updatedWorkspace)
            // If this is the first workspace, automatically save it
            if (workspacesToRender.length === 0) {
                try {
                    await saveEdit()
                } catch (error) {
                    console.error('Failed to save new workspace:', error)
                }
            }
        } else {
            // Update existing workspace
            updateWorkspace(updatedWorkspace.id, updatedWorkspace)
        }
    }

    const handleEditWorkspace = (workspace: WorkspaceWithChildren) => {
        setSelectedWorkspaceForEdit(workspace)
        setIsCreatingNewWorkspace(false)
        setSettingsDialogOpen(true)
    }

    const handleDeleteWorkspace = (workspaceId: string) => {
        deleteWorkspace(workspaceId)
    }

    // Handler for adding new workspace
    const handleAddWorkspace = () => {
        setSelectedWorkspaceForEdit(null)
        setIsCreatingNewWorkspace(true)
        setSettingsDialogOpen(true)
    }

    const renderWorkspace = (workspace: WorkspaceWithChildren, level = 0) => {
        const hasChildren = workspace.children.length > 0
        const isExpanded = expandedWorkspaces.has(workspace.id)
        const isSelected = selectedWorkspace?.id === workspace.id

        // Get drag and drop props for this specific workspace
        const dropZoneProps = getDropZoneProps(workspace, level)
        const dragProps = getDragProps(workspace, level)
        const beforeIndicatorProps = getDropIndicatorProps(workspace, 'before')
        const afterIndicatorProps = getDropIndicatorProps(workspace, 'after')
        const insideIndicatorProps = getDropIndicatorProps(workspace, 'inside')


        return (
            <div key={workspace.id} className="zd:flex zd:flex-col zd:gap-1">
                <div
                    {...dropZoneProps}
                    className={cn(
                        dropZoneProps.className,
                        "zd:flex zd:items-center zd:gap-2 zd:hover:bg-muted zd:rounded-md zd:group zd:relative",
                        isSelected ? "zd:bg-muted" : ""
                    )}
                    style={{ marginLeft: `${level * 16}px` }}
                >
                    {/* Drop indicators */}
                    <div {...beforeIndicatorProps} />
                    <div {...afterIndicatorProps} />
                    <div {...insideIndicatorProps} />

                    {/* Drag handle */}
                    <div
                        {...dragProps}
                        className={cn(
                            dragProps.className,
                            "zd:flex zd:items-center zd:gap-2 zd:flex-1 zd:p-2 zd:pl-4 ",
                            isDragging ? "zd:cursor-grabbing" : "zd:cursor-grab"
                        )}
                        onClick={() => setSelectedWorkspace(workspace)}
                    >
                        {hasChildren && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpanded(workspace.id)
                                }}
                                className="zd:absolute zd:top-2 zd:right-1 zd:flex zd:items-center zd:justify-center zd:w-6 zd:h-6 zd:hover:bg-muted-foreground/20 zd:rounded-sm"
                            >
                                {isExpanded ? (
                                    <LucideIcons.ChevronDown className="zd:w-3 zd:h-3" />
                                ) : (
                                    <LucideIcons.ChevronRight className="zd:w-3 zd:h-3" />
                                )}
                            </button>
                        )}
                        {isEditing ? (
                            // In editing mode, show compact icon picker
                            <WorkspaceIconPicker
                                selectedIcon={workspace.icon || "Folder"}
                                onIconSelect={(iconName) => handleIconSelect(workspace.id, iconName)}
                                size="small"
                                variant="compact"
                            />
                        ) : (
                            // In normal mode, show static icon
                            <div className="zd:rounded-md zd:p-1">
                                <DynamicIcon
                                    iconName={workspace.icon as IconName}
                                    className="zd:w-4 zd:h-4"
                                />
                            </div>
                        )}

                        {/* Floating edit toolbar - only show in editing mode */}
                        {isEditing && (
                            <div className="zd:absolute zd:right-8 zd:bottom-0.5 zd:bg-muted zd:flex zd:items-center zd:justify-center zd:w-fit zd:h-fit zd:p-1 zd:rounded zd:gap-1 zd:opacity-20 zd:group-hover:opacity-100 zd:transition-opacity">
                                <button
                                    className="zd:cursor-pointer zd:p-2 zd:bg-muted-foreground/20 zd:rounded-lg transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditWorkspace(workspace)
                                    }}
                                    title="Edit workspace"
                                >
                                    <LucideIcons.Settings className="zd:w-4 zd:h-4" />
                                </button>
                                <button
                                    className="zd:cursor-pointer zd:text-destructive zd:p-2 zd:bg-destructive/20 zd:rounded-lg transition-opacity"
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        const con = await confirm({
                                            title: "Delete workspace",
                                            message: `Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`,
                                            confirmText: "Delete",
                                            cancelText: "Cancel",
                                            variant: "destructive"
                                        })
                                        if (con) {
                                            handleDeleteWorkspace(workspace.id)
                                        }
                                    }}
                                    title="Delete workspace"
                                >
                                    <LucideIcons.Trash2 className="zd:w-4 zd:h-4" />
                                </button>
                            </div>
                        )}
                        <span className={cn(
                            "zd:flex-1"
                        )}>
                            {t(workspace.name)}
                        </span>
                    </div>
                </div>
                {hasChildren && isExpanded && (
                    <div>
                        {workspace.children.map(child => renderWorkspace(child, level + 1))}
                    </div>
                )}
            </div>
        )
    }

    return <div className="zd:flex zd:flex-col zd:gap-1">
        <div className="zd:flex zd:items-center zd:justify-between">
            <span className="zd:text-sm zd:text-muted-foreground zd:min-h-6">Workspaces</span>
            {(isEditing || workspacesToRender.length === 0) && (
                <Button
                    variant="subtle"
                    onClick={handleAddWorkspace}
                    className="zd:p-1 zd:h-6 zd:w-6"
                    title="Add new workspace"
                >
                    <LucideIcons.Plus className="zd:w-4 zd:h-4" />
                </Button>
            )}
        </div>
        {workspacesToRender.length === 0 ? (
            <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:py-8 zd:px-4 zd:text-center">
                <LucideIcons.Folder className="zd:w-12 zd:h-12 zd:text-muted-foreground/50 zd:mb-4" />
                <p className="zd:text-sm zd:text-muted-foreground zd:mb-2">No workspaces yet</p>
                <p className="zd:text-xs zd:text-muted-foreground/70 zd:mb-4">Create your first workspace to get started</p>
                <Button
                    variant="outline"
                    onClick={handleAddWorkspace}
                    className="zd:flex zd:items-center zd:gap-2"
                >
                    <LucideIcons.Plus className="zd:w-4 zd:h-4" />
                    Create Workspace
                </Button>
            </div>
        ) : (
            workspacesToRender.map(workspace => renderWorkspace(workspace, 0))
        )}

        {/* Workspace Settings Dialog */}
        <WorkspaceSettingsDialog
            workspace={selectedWorkspaceForEdit}
            isOpen={settingsDialogOpen}
            onClose={handleCloseSettings}
            onApply={handleApplySettings}
            isCreatingNew={isCreatingNewWorkspace}
        />

    </div>
}