import { useState, useEffect } from "react"
import { FormControl } from "../ui/form-control"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog"
import type { WorkspaceItem } from "./use-workspace"
import { workspaceItemPlugins } from "../workspace-item"

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

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <div className="zd:fixed zd:inset-0 zd:z-50 zd:flex zd:items-center zd:justify-center">
                <div className="zd:fixed zd:inset-0 zd:bg-black/50" onClick={onClose} />
                <DialogContent className="zd:relative zd:bg-white zd:rounded-lg zd:shadow-lg zd:border zd:border-gray-200 zd:max-w-md zd:w-full zd:m-4">
                    <div className="zd:p-6">
                        <DialogTitle className="zd:mb-4">
                            {isConfiguringNewItem ? `Add ${plugin.options.name}` : `Edit ${plugin.options.name}`}
                        </DialogTitle>
                        
                        <div className="zd:space-y-4">
                            {/* Value field */}
                            {plugin.renderEditValue && (
                                <FormControl
                                    label="Value"
                                    fieldKey="value"
                                    value={editedItem.value}
                                    onChange={handleValueChange}
                                >
                                    {plugin.renderEditValue({
                                        value: editedItem.value,
                                        onChange: (newValue: any) => handleValueChange('value', newValue)
                                    })}
                                </FormControl>
                            )}

                            {/* Options field */}
                            {plugin.renderEditOptions && (
                                <FormControl
                                    label="Options"
                                    fieldKey="options"
                                    value={editedItem.options}
                                    onChange={handleValueChange}
                                >
                                    {plugin.renderEditOptions({
                                        value: editedItem.options,
                                        onChange: (newValue: any) => handleValueChange('options', newValue)
                                    })}
                                </FormControl>
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
