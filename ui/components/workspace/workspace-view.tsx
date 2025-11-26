import { useWorkspace, useWorkspaceEdit, type WorkspaceWithChildren } from "./use-workspace"
import type { WorkspaceItem } from "./use-workspace"
import { workspaceItemPlugins } from "../workspace-item"
import { useRef, useMemo, useCallback, useState, useEffect } from "react"
import { Button } from "../ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import * as LucideIcons from "lucide-react"
import { cn } from "../../lib/utils"
import { useDragHandle, useDropIndicator } from "../../hooks/use-dnd"
import { useWorkspaceItemDnd } from "../../hooks/use-workspace-item-dnd"
import { confirm, popup } from "../ui/popit"
import { WorkspaceItemSettingsDialog } from "./workspace-item-settings-dialog"

export const WorkspaceView = () => {
    const { selectedWorkspace, reloadWorkspaces, reloadWorkspaceItems, workspaceItems, workspaces, getWorkspaceItems } = useWorkspace()
    const { isEditing, updateWorkspaceItem, addWorkspaceItem, editedWorkspaceItems, editedWorkspaces, reorderWorkspaceItems, getEditedWorkspaceItems, deleteWorkspaceItem } = useWorkspaceEdit()
    const containerRef = useRef<HTMLDivElement>(null)

    // Settings dialog state
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<WorkspaceItem | null>(null)
    const [isConfiguringNewItem, setIsConfiguringNewItem] = useState(false)

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

    // Get current items (edited or original)
    const currentItems = useMemo(() => {
        if (!currentWorkspace) return [];

        if (isEditing) {
            // In edit mode, get items from the current workspace only (not children)
            return getEditedWorkspaceItems(currentWorkspace.id);
        } else {
            // In normal mode, use the existing function
            return getWorkspaceItems(currentWorkspace.id);
        }
    }, [isEditing, currentWorkspace, getEditedWorkspaceItems, getWorkspaceItems, editedWorkspaceItems, editedWorkspaces, workspaceItems, workspaces])

    // Initialize drag and drop
    const {
        getDropZoneProps,
        getDragProps,
        getDropIndicatorProps,
        draggedItem,
        isDragging
    } = useWorkspaceItemDnd({
        items: currentItems,
        onReorder: (fromId: string, toId: string, type: "before" | "after") => {
            if (currentWorkspace) {
                reorderWorkspaceItems(fromId, toId, type);
            }
        },
        disabled: !isEditing
    })

    // Settings dialog handlers
    const handleOpenSettings = (item: WorkspaceItem) => {
        setSelectedItem(item)
        setIsConfiguringNewItem(false)
        setSettingsDialogOpen(true)
    }

    const handleCloseSettings = () => {
        setSettingsDialogOpen(false)
        setSelectedItem(null)
        setIsConfiguringNewItem(false)
    }

    const handleApplySettings = (updatedItem: WorkspaceItem) => {
        if (currentWorkspace) {
            if (isConfiguringNewItem) {
                // Add new item to workspace
                addWorkspaceItem(currentWorkspace.id, updatedItem)
            } else {
                // Update existing item - it belongs to the current workspace
                updateWorkspaceItem(currentWorkspace.id, updatedItem)
            }
        }
    }

    // Handler for adding new workspace item
    const handleAddWorkspaceItem = (pluginType: string) => {
        if (currentWorkspace) {
            const tempItem: WorkspaceItem = {
                id: "temp-workspace-item-" + Date.now(),
                type: pluginType,
                value: "",
                options: "",
                workspaceId: currentWorkspace.id
            }
            setSelectedItem(tempItem)
            setIsConfiguringNewItem(true)
            setSettingsDialogOpen(true)
        }
    }

    const handleDeleteWorkspaceItem = (itemId: string) => {
        if (currentWorkspace) {
            // Delete item from the current workspace
            deleteWorkspaceItem(currentWorkspace.id, itemId)
        }
    }


    if (!currentWorkspace) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                Select a workspace to view its items
            </div>
        )
    }


    const renderWorkspaceItem = (item: WorkspaceItem, index: number) => {
        const plugin = workspaceItemPlugins[item.type as keyof typeof workspaceItemPlugins]
        const dropZoneProps = getDropZoneProps(item)
        const dragProps = getDragProps(item)
        const dragHandleProps = useDragHandle()

        // Get drop indicator props for before and after
        const beforeIndicatorProps = getDropIndicatorProps(item, 'before')
        const afterIndicatorProps = getDropIndicatorProps(item, 'after')

        if (!plugin) {
            return (
                <div
                    key={item.id}
                    {...dropZoneProps}
                    className={cn(
                        "zd:p-4 zd:bg-yellow-50 zd:border zd:border-yellow-200 zd:rounded zd:relative",
                        dropZoneProps.className
                    )}
                >
                    <div {...dragProps} className={cn("zd:h-full", dragProps.className)}>
                        {isEditing && (
                            <div {...dragHandleProps} className="zd:absolute zd:top-2 zd:right-2 zd:p-1 zd:bg-yellow-100 zd:rounded zd:opacity-0 hover:zd:opacity-100 transition-opacity zd:border-yellow-200">
                                <LucideIcons.GripVertical className="zd:w-4 zd:h-4" />
                            </div>
                        )}
                        <div className="zd:pr-8">
                            <p className="zd:text-yellow-800">Unknown item type: {item.type}</p>
                            <p className="zd:text-xs zd:text-gray-500">Available types: {Object.keys(workspaceItemPlugins).join(', ')}</p>
                        </div>
                    </div>
                    <div {...beforeIndicatorProps} />
                    <div {...afterIndicatorProps} />
                </div>
            )
        }

        return (
            <div
                key={item.id}
                {...dropZoneProps}
                className={cn(
                    "zd:relative zd:group zd:rounded-lg zd:relative",
                    isEditing ? "zd:bg-white zd:border zd:border-gray-200 zd:hover:shadow-sm zd:transition-shadow" : "",
                    plugin.flexClass
                )}
            >
                <div {...dragProps} className={cn("zd:h-full", dragProps.className)}>
                    {isEditing && (
                        <div
                            {...dragHandleProps}
                            className="zd:absolute zd:top-2 zd:right-2 zd:p-1 zd:bg-gray-100 zd:rounded zd:opacity-0 hover:zd:opacity-100 transition-opacity zd:border zd:border-gray-200"
                            title="Drag to reorder"
                        >
                            <LucideIcons.GripVertical className="zd:w-4 zd:h-4 zd:text-gray-600" />
                        </div>
                    )}
                    {isDragging && draggedItem?.id === item.id && (
                        <div className="zd:absolute zd:inset-0 zd:bg-blue-50 zd:border-2 zd:border-blue-300 zd:rounded-lg zd:pointer-events-none zd:z-10">
                            <div className="zd:absolute zd:top-2 zd:left-2 zd:bg-blue-500 zd:text-white zd:px-2 zd:py-1 zd:rounded zd:text-xs zd:font-medium">
                                Moving...
                            </div>
                        </div>
                    )}
                    <plugin.render
                        value={item.value}
                        options={item.options}
                        item={item}
                        isEditing={isEditing}
                    />
                </div>
                <div {...beforeIndicatorProps} />
                <div {...afterIndicatorProps} />
                <div className={cn(
                    "zd:absolute zd:right-1 zd:bottom-[-16px] zd:bg-muted zd:flex zd:items-center zd:justify-center zd:w-fit zd:h-fit zd:p-1 zd:rounded zd:gap-1 zd:opacity-20 zd:group-hover:opacity-100",
                    isEditing ? "zd:flex" : "zd:hidden"
                )}>
                    <button
                        className="zd:cursor-pointer zd:p-2 zd:bg-muted-foreground/20 zd:rounded-lg transition-opacity"
                        onClick={() => handleOpenSettings(item)}
                        title="Edit settings"
                    >
                        <LucideIcons.Settings />
                    </button>
                    {/* Delete button */}
                    <button
                        className="zd:cursor-pointer zd:text-destructive zd:p-2 zd:bg-destructive/20 zd:rounded-lg transition-opacity"
                        onClick={async () => {
                            const con = await confirm({
                                title: "Delete item",
                                message: "Are you sure you want to delete this item?",
                                confirmText: "Delete",
                                cancelText: "Cancel",
                                variant: "destructive"
                            })
                            if (con) {
                                handleDeleteWorkspaceItem(item.id)
                            }
                        }}
                        title="Delete item"
                    >
                        <LucideIcons.Trash />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="zd:flex zd:flex-col">
            <span className="zd:text-sm zd:text-muted-foreground zd:min-h-7"></span>
            {currentItems.length > 0 ? (
                <div
                    ref={containerRef}
                    className="zd:flex zd:flex-wrap zd:gap-4 zd:justify-start"
                // className="zd:grid zd:xl:grid-cols-2 zd:lg:grid-cols-3 zd:md:grid-cols-2 zd:grid-cols-1 zd:gap-4"
                >
                    {currentItems.map((item, index) => renderWorkspaceItem(item, index))}
                </div>
            ) : (
                <div className="zd:flex zd:items-center zd:justify-center zd:h-64 zd:text-gray-500">
                    No items in this workspace
                </div>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild className={cn(
                    !isEditing ? "zd:hidden" : "",
                    "zd:w-full",
                    "zd:mt-4"
                )}>
                    <Button variant="subtle">
                        <LucideIcons.Plus />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {Object.keys(workspaceItemPlugins).map((plugin) => (
                        <DropdownMenuItem key={plugin} onClick={() => handleAddWorkspaceItem(plugin)}>
                            <div className="zd:flex zd:flex-col zd:gap-1 zd:min-w-40">
                                <span className="zd:font-semibold">
                                    {workspaceItemPlugins[plugin as keyof typeof workspaceItemPlugins].options.name}
                                </span>
                                <span className="zd:text-xs zd:text-muted-foreground">
                                    {workspaceItemPlugins[plugin as keyof typeof workspaceItemPlugins].options.description}
                                </span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Dialog */}
            <WorkspaceItemSettingsDialog
                item={selectedItem}
                isOpen={settingsDialogOpen}
                onClose={handleCloseSettings}
                onApply={handleApplySettings}
                isConfiguringNewItem={isConfiguringNewItem}
            />
        </div>
    )
}