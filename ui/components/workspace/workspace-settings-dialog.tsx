import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { FormControl } from "../ui/form-control"
import { WorkspaceIconPicker } from "./workspace-icon-picker"
import type { WorkspaceWithChildren } from "./use-workspace"

interface WorkspaceSettingsDialogProps {
    workspace: WorkspaceWithChildren | null
    isOpen: boolean
    onClose: () => void
    onApply: (workspace: WorkspaceWithChildren) => void
    isCreatingNew: boolean
}

export const WorkspaceSettingsDialog = ({ 
    workspace, 
    isOpen, 
    onClose, 
    onApply,
    isCreatingNew
}: WorkspaceSettingsDialogProps) => {
    const [editedWorkspace, setEditedWorkspace] = useState<WorkspaceWithChildren | null>(null)

    useEffect(() => {
        if (workspace) {
            setEditedWorkspace({ ...workspace })
        } else {
            // Create new workspace template
            setEditedWorkspace({
                id: "temp-workspace-" + Date.now(),
                name: "",
                idx: 0,
                workspace_parent: null,
                icon: "Folder",
                app: "zodula",
                children: [],
                items: []
            })
        }
    }, [workspace])

    const handleValueChange = (fieldName: string, value: any) => {
        setEditedWorkspace(prev => prev ? { ...prev, [fieldName as keyof WorkspaceWithChildren]: value } : null)
    }

    const handleApply = () => {
        if (editedWorkspace) {
            onApply(editedWorkspace)
            onClose()
        }
    }

    if (!editedWorkspace) return null

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <div className="zd:fixed zd:inset-0 zd:z-50 zd:flex zd:items-center zd:justify-center">
                <div className="zd:fixed zd:inset-0 zd:bg-black/50" onClick={onClose} />
                <DialogContent className="zd:relative zd:bg-white zd:rounded-lg zd:shadow-lg zd:border zd:border-gray-200 zd:max-w-md zd:w-full zd:m-4">
                    <div className="zd:p-6">
                        <DialogTitle className="zd:mb-4">
                            {isCreatingNew ? "Create New Workspace" : "Edit Workspace"}
                        </DialogTitle>
                        
                        <div className="zd:space-y-4">
                            {/* Name field */}
                            <FormControl
                                label="Name"
                                fieldKey="name"
                                value={editedWorkspace.name}
                                onChange={handleValueChange}
                            >
                                <Input
                                    value={editedWorkspace.name || ""}
                                    onChange={(e) => handleValueChange('name', e.target.value)}
                                    placeholder="Enter workspace name"
                                />
                            </FormControl>

                            {/* Icon field */}
                            <FormControl
                                label="Icon"
                                fieldKey="icon"
                                value={editedWorkspace.icon}
                                onChange={handleValueChange}
                            >
                                <WorkspaceIconPicker
                                    selectedIcon={editedWorkspace.icon || "Folder"}
                                    onIconSelect={(iconName) => handleValueChange('icon', iconName)}
                                    showLabel={true}
                                    size="medium"
                                    variant="default"
                                />
                            </FormControl>
                        </div>

                        <div className="zd:flex zd:justify-end zd:gap-2 zd:mt-6">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleApply}>
                                {isCreatingNew ? 'Create' : 'Apply'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </div>
        </Dialog>
    )
}
