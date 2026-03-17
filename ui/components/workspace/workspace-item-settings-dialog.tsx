import { useState, useEffect } from "react"
import { FormControl } from "../ui/form-control"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog"
import type { WorkspaceItem } from "./use-workspace"
import { workspaceItemPlugins } from "../workspace-item"
import { Input } from "../ui/input"

interface WorkspaceItemSettingsDialogProps {
    item: WorkspaceItem | null
    isOpen: boolean
    onClose: () => void
    onApply: (item: WorkspaceItem) => void
    isConfiguringNewItem?: boolean
}

export const WorkspaceItemSettingsDialog = ({
    item,
    isOpen,
    onClose,
    onApply,
    isConfiguringNewItem = false
}: WorkspaceItemSettingsDialogProps) => {
    const [editedItem, setEditedItem] = useState<WorkspaceItem | null>(null)

    // Initialize edited item when dialog opens
    useEffect(() => {
        if (item && isOpen) {
            setEditedItem({ ...item })
        }
    }, [item, isOpen])

    if (!item || !editedItem) {
        return null
    }

    const plugin = workspaceItemPlugins[item.type as keyof typeof workspaceItemPlugins]
    if (!plugin) {
        return null
    }

    const handleValueChange = (fieldKey: string, value: any) => {
        setEditedItem(prev => prev ? { ...prev, [fieldKey]: value } : null)
    }

    const handleApply = () => {
        if (editedItem) {
            onApply(editedItem)
            onClose()
        }
    }

    const EditValueComponent = plugin.renderEditValue || (() => <Input value={editedItem.value || ""} onChange={(e) => handleValueChange('value', e.target.value)} />)

    const EditOptionsComponent = plugin.renderEditOptions || (() => null)

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <div className="zd:fixed zd:inset-0 zd:z-50 zd:flex zd:items-center zd:justify-center">
                <div className="zd:fixed zd:inset-0 zd:bg-black/50" onClick={onClose} />
                <DialogContent className="zd:relative zd:bg-white zd:rounded-lg zd:shadow-lg zd:border zd:border-muted zd:max-w-md zd:w-full zd:m-4">
                    <div className="zd:p-6">
                        <DialogTitle className="zd:mb-4">
                            {isConfiguringNewItem ? `Add ${plugin.options.name}` : `Edit ${plugin.options.name}`}
                        </DialogTitle>

                        <div className="zd:space-y-4">
                            {/* Main value / type-specific primary field */}
                            {plugin.renderEditValue && (
                                <EditValueComponent
                                    item={editedItem}
                                    onChange={handleValueChange}
                                />
                            )}

                            {/* Type-specific extra fields (label, url, heading_level, etc.) */}
                            {plugin.renderEditOptions && (
                                <EditOptionsComponent
                                    item={editedItem}
                                    onChange={handleValueChange}
                                />
                            )}
                        </div>

                        <div className="zd:flex zd:justify-end zd:gap-2 zd:mt-6">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleApply}>
                                {isConfiguringNewItem ? 'Add' : 'Apply'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </div>
        </Dialog>
    )
}
