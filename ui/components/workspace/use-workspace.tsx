import { create } from "zustand";
import { useMemo, useEffect } from "react";
import { zodula } from "@/zodula/client";

export interface WorkspaceItem {
    id: string
    idx?: number | null
    type?: string | null
    value?: string | null
    options?: string | null
    workspaceId: string
}

export interface WorkspaceWithChildren {
    id: string
    name: string
    idx?: number | null
    workspace_parent?: string | null
    icon?: string | null
    app: string | null
    children: WorkspaceWithChildren[]
    items: WorkspaceItem[]
}

interface WorkspaceState {
    selectedWorkspace: WorkspaceWithChildren | null;
    setSelectedWorkspace: (workspace: WorkspaceWithChildren) => void;
}

interface WorkspaceEditState {
    isEditing: boolean;
    editedWorkspaces: WorkspaceWithChildren[];
    editedWorkspaceItems: Record<string, WorkspaceItem[]>; // Changed to separate by workspace ID
    originalWorkspaces: WorkspaceWithChildren[];
    originalWorkspaceItems: Record<string, WorkspaceItem[]>;
    setIsEditing: (isEditing: boolean) => void;
    initializeEditMode: (workspaces: WorkspaceWithChildren[], originalWorkspaces?: WorkspaceWithChildren[], originalWorkspaceItems?: Record<string, WorkspaceItem[]>) => void;
    addWorkspace: (workspace: WorkspaceWithChildren) => void;
    addWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => void;
    updateWorkspace: (workspaceId: string, workspace: WorkspaceWithChildren) => void;
    updateWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => void;
    deleteWorkspace: (workspaceId: string) => void;
    deleteWorkspaceItem: (workspaceId: string, itemId: string) => void;
    reorderWorkspaceItems: (fromId: string, toId: string, type: "before" | "after") => void;
    reorderWorkspace: (fromId: string, toId: string, type: "before" | "after" | "inside") => void;
    getEditedWorkspaceItems: (workspaceId: string) => WorkspaceItem[];

    discardEdit: () => void;
    saveEdit: () => void;
    hasChanges: () => boolean;
    initializeEditModeFromStore: () => void;

}

const STORAGE_KEY = 'zodula-selected-workspace';

// Workspace Data Store for managing workspace and workspace item data
interface WorkspaceDataState {
    workspaces: any[];
    workspaceItems: any[];
    isLoading: boolean;
    error: string | null;
    setWorkspaces: (workspaces: any[]) => void;
    setWorkspaceItems: (workspaceItems: any[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reloadWorkspaces: () => Promise<void>;
    reloadWorkspaceItems: () => Promise<void>;
    reloadAll: () => Promise<void>;
}

export const useWorkspaceDataStore = create<WorkspaceDataState>((set, get) => ({
    workspaces: [],
    workspaceItems: [],
    isLoading: false,
    error: null,

    setWorkspaces: (workspaces: any[]) => set({ workspaces }),
    setWorkspaceItems: (workspaceItems: any[]) => set({ workspaceItems }),
    setLoading: (isLoading: boolean) => set({ isLoading }),
    setError: (error: string | null) => set({ error }),

    reloadWorkspaces: async () => {
        set({ isLoading: true, error: null });
        try {
            const result = await zodula.doc.select_docs("zodula__Workspace", {
                limit: 1000000,
                sort: "idx",
                order: "asc",
                q: "",
                filters: []
            });
            set({ workspaces: result.docs, isLoading: false });
        } catch (error) {
            console.error('Failed to reload workspaces:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to reload workspaces';
            set({ error: errorMessage, isLoading: false });
        }
    },

    reloadWorkspaceItems: async () => {
        set({ isLoading: true, error: null });
        try {
            const result = await zodula.doc.select_docs("zodula__Workspace Item", {
                limit: 1000000,
                sort: "idx",
                order: "asc",
                q: "",
                filters: []
            });
            set({ workspaceItems: result.docs, isLoading: false });
        } catch (error) {
            console.error('Failed to reload workspace items:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to reload workspace items';
            set({ error: errorMessage, isLoading: false });
        }
    },

    reloadAll: async () => {
        set({ isLoading: true, error: null });
        try {
            const [workspacesResult, workspaceItemsResult] = await Promise.all([
                zodula.doc.select_docs("zodula__Workspace", {
                    limit: 1000000,
                    sort: "idx",
                    order: "asc",
                    q: "",
                    filters: []
                }),
                zodula.doc.select_docs("zodula__Workspace Item", {
                    limit: 1000000,
                    sort: "idx",
                    order: "asc",
                    q: "",
                    filters: []
                })
            ]);
            set({
                workspaces: workspacesResult.docs,
                workspaceItems: workspaceItemsResult.docs,
                isLoading: false
            });
        } catch (error) {
            console.error('Failed to reload workspace data:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to reload workspace data';
            set({ error: errorMessage, isLoading: false });
        }
    }
}));

// Helper function to build hierarchical workspaces
const buildHierarchicalWorkspaces = (workspaces: any[], workspaceItems: any[]): WorkspaceWithChildren[] => {
    // Create a map for quick lookup
    const workspaceMap = new Map<string, WorkspaceWithChildren>()

    // Initialize all workspaces with empty children array and items
    workspaces.forEach(workspace => {
        workspaceMap.set(workspace.id, {
            ...workspace,
            children: [],
            items: [],
        })
    })

    // Group workspace items by workspaceId
    const itemsByWorkspace = new Map<string, WorkspaceItem[]>()
    workspaceItems.forEach(item => {
        if (!itemsByWorkspace.has(item.workspaceId)) {
            itemsByWorkspace.set(item.workspaceId, [])
        }
        itemsByWorkspace.get(item.workspaceId)!.push(item)
    })

    // Assign items to workspaces
    workspaceMap.forEach((workspace, workspaceId) => {
        const items = itemsByWorkspace.get(workspaceId) || []
        // Sort items by idx
        workspace.items = items.sort((a, b) => (a.idx || 0) - (b.idx || 0))
    })

    // Sort workspaces by idx first
    const sortedWorkspaces = [...workspaces].sort((a, b) => (a.idx || 0) - (b.idx || 0))

    // Build hierarchy using workspace_parent field
    const rootWorkspaces: WorkspaceWithChildren[] = []

    sortedWorkspaces.forEach(workspace => {
        const workspaceWithChildren = workspaceMap.get(workspace.id)!

        if (workspace.workspace_parent) {
            // This is a child workspace, find its parent
            const parent = workspaceMap.get(workspace.workspace_parent)
            if (parent) {
                parent.children.push(workspaceWithChildren)
            } else {
                // Parent not found, add to root
                rootWorkspaces.push(workspaceWithChildren)
            }
        } else {
            // This is a root workspace (no parent)
            rootWorkspaces.push(workspaceWithChildren)
        }
    })

    // Sort children by idx
    rootWorkspaces.forEach(workspace => {
        workspace.children.sort((a, b) => (a.idx || 0) - (b.idx || 0))
    })

    return rootWorkspaces
};

// Helper function to flatten hierarchical workspaces into a flat array
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

// Helper function to detect workspace changes
const detectWorkspaceChanges = (original: WorkspaceWithChildren[], edited: WorkspaceWithChildren[]) => {
    const changes = {
        added: [] as WorkspaceWithChildren[],
        updated: [] as WorkspaceWithChildren[],
        deleted: [] as string[],
        reordered: [] as { id: string, newIdx: number | null, oldIdx: number | null }[]
    };

    // Flatten both original and edited to get all workspaces including children
    const originalFlat = flattenWorkspaces(original);
    const editedFlat = flattenWorkspaces(edited);


    // Create maps for easier lookup
    const originalMap = new Map(originalFlat.map(w => [w.id, w]));
    const editedMap = new Map(editedFlat.map(w => [w.id, w]));

    // Find added and updated workspaces
    editedFlat.forEach(editedWorkspace => {
        const originalWorkspace = originalMap.get(editedWorkspace.id);

        if (!originalWorkspace) {
            // New workspace
            changes.added.push(editedWorkspace);
        } else {
            // Check if workspace was updated (compare all properties except children)
            const { children: originalChildren, ...originalWithoutChildren } = originalWorkspace;
            const { children: editedChildren, ...editedWithoutChildren } = editedWorkspace;

            const isUpdated = JSON.stringify(originalWithoutChildren) !== JSON.stringify(editedWithoutChildren);
            if (isUpdated) {
                changes.updated.push(editedWorkspace);
            }

            // Check if idx changed (reordering)
            if (originalWorkspace.idx !== editedWorkspace.idx) {
                changes.reordered.push({
                    id: editedWorkspace.id,
                    newIdx: editedWorkspace.idx ?? null,
                    oldIdx: originalWorkspace.idx ?? null
                });
            }
        }
    });

    // Find deleted workspaces
    originalFlat.forEach(originalWorkspace => {
        if (!editedMap.has(originalWorkspace.id)) {
            changes.deleted.push(originalWorkspace.id);
        }
    });

    return changes;
};

// Helper function to detect workspace item changes
const detectWorkspaceItemChanges = (original: Record<string, WorkspaceItem[]>, edited: Record<string, WorkspaceItem[]>) => {
    const changes = {
        added: [] as WorkspaceItem[],
        updated: [] as WorkspaceItem[],
        deleted: [] as { workspaceId: string, itemId: string }[],
        reordered: [] as { workspaceId: string, itemId: string, newIdx: number | null, oldIdx: number | null }[]
    };

    // Get all workspace IDs from both original and edited
    const allWorkspaceIds = new Set([...Object.keys(original), ...Object.keys(edited)]);

    allWorkspaceIds.forEach(workspaceId => {
        const originalItems = original[workspaceId] || [];
        const editedItems = edited[workspaceId] || [];

        // Create maps for easier lookup
        const originalMap = new Map(originalItems.map(item => [item.id, item]));
        const editedMap = new Map(editedItems.map(item => [item.id, item]));

        // Find added and updated items
        editedItems.forEach(editedItem => {
            const originalItem = originalMap.get(editedItem.id);

            if (!originalItem) {
                // New item
                changes.added.push(editedItem);
            } else {
                // Check if item was updated
                const isUpdated = JSON.stringify(originalItem) !== JSON.stringify(editedItem);
                if (isUpdated) {
                    changes.updated.push(editedItem);
                }

                // Check if idx changed (reordering)
                if (originalItem.idx !== editedItem.idx) {
                    changes.reordered.push({
                        workspaceId,
                        itemId: editedItem.id,
                        newIdx: editedItem.idx ?? null,
                        oldIdx: originalItem.idx ?? null
                    });
                }
            }
        });

        // Find deleted items
        originalItems.forEach(originalItem => {
            if (!editedMap.has(originalItem.id)) {
                changes.deleted.push({
                    workspaceId,
                    itemId: originalItem.id
                });
            }
        });
    });

    return changes;
};

const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    selectedWorkspace: null,
    setSelectedWorkspace: (workspace: WorkspaceWithChildren) => {
        set({ selectedWorkspace: workspace });
        // Persist to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
        } catch (error) {
            console.warn('Failed to save selected workspace to localStorage:', error);
        }
    },
}))

export const useWorkspaceEdit = create<WorkspaceEditState & {
    isSaving: boolean;
    saveError: string | null;
}>((set, get) => ({
    isEditing: false,
    editedWorkspaces: [],
    editedWorkspaceItems: {},
    originalWorkspaces: [],
    originalWorkspaceItems: {},
    isSaving: false,
    saveError: null,
    saveEdit: async () => {
        const state = get();
        const { editedWorkspaces, editedWorkspaceItems, originalWorkspaces, originalWorkspaceItems } = state;

        // Set loading state
        set({ isSaving: true, saveError: null });

        try {
            // Detect changes in workspaces
            const workspaceChanges = detectWorkspaceChanges(originalWorkspaces, editedWorkspaces);

            // Detect changes in workspace items
            const workspaceItemChanges = detectWorkspaceItemChanges(originalWorkspaceItems, editedWorkspaceItems);


            // Apply workspace changes
            if (workspaceChanges.added.length > 0) {
                const workspaceInserts = workspaceChanges.added.map((workspace: WorkspaceWithChildren) => ({
                    name: workspace.name,
                    idx: workspace.idx || 0,
                    workspace_parent: workspace.workspace_parent || null,
                    icon: workspace.icon || null,
                    app: workspace.app || "zodula" // Default app
                }));
                await zodula.doc.create_docs("zodula__Workspace", workspaceInserts);
            }

            if (workspaceChanges.updated.length > 0) {
                for (const workspace of workspaceChanges.updated) {
                    await zodula.doc.update_doc("zodula__Workspace", workspace.id, {
                        name: workspace.name,
                        idx: workspace.idx || 0,
                        workspace_parent: workspace.workspace_parent || null,
                        icon: workspace.icon || null,
                        app: workspace.app || "zodula"
                    });
                }
            }

            if (workspaceChanges.deleted.length > 0) {
                await zodula.doc.delete_docs("zodula__Workspace", workspaceChanges.deleted);
            }

            // Apply workspace item changes
            if (workspaceItemChanges.added.length > 0) {
                const itemInserts = workspaceItemChanges.added.map((item: WorkspaceItem) => ({
                    idx: item.idx || 0,
                    type: item.type || null as any,
                    value: item.value || null,
                    options: item.options || null,
                    workspaceId: item.workspaceId
                }));
                await zodula.doc.create_docs("zodula__Workspace Item", itemInserts);
            }

            if (workspaceItemChanges.updated.length > 0) {
                for (const item of workspaceItemChanges.updated) {
                    await zodula.doc.update_doc("zodula__Workspace Item", item.id, {
                        idx: item.idx || 0,
                        type: item.type || null as any,
                        value: item.value || null,
                        options: item.options || null,
                        workspaceId: item.workspaceId
                    });
                }
            }

            if (workspaceItemChanges.deleted.length > 0) {
                const itemIds = workspaceItemChanges.deleted.map(item => item.itemId);
                await zodula.doc.delete_docs("zodula__Workspace Item", itemIds);
            }

            // Reset editing state and clear loading
            set({ isEditing: false, isSaving: false, saveError: null });

            // Reload data from the shared store
            const dataStore = useWorkspaceDataStore.getState();
            await dataStore.reloadAll();

        } catch (error) {
            console.error('Failed to save workspace changes:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to save workspace changes';
            set({ isSaving: false, saveError: errorMessage });
            throw error;
        }
    },
    discardEdit: () => {
        // Reset editing state and clear edited data
        set({
            isEditing: false,
            editedWorkspaces: [],
            editedWorkspaceItems: {},
            originalWorkspaces: [],
            originalWorkspaceItems: {}
        });
    },

    hasChanges: () => {
        const state = get();
        const { editedWorkspaces, editedWorkspaceItems, originalWorkspaces, originalWorkspaceItems } = state;

        // Check for workspace changes
        const workspaceChanges = detectWorkspaceChanges(originalWorkspaces, editedWorkspaces);
        const hasWorkspaceChanges = workspaceChanges.added.length > 0 ||
            workspaceChanges.updated.length > 0 ||
            workspaceChanges.deleted.length > 0 ||
            workspaceChanges.reordered.length > 0;

        // Check for workspace item changes
        const workspaceItemChanges = detectWorkspaceItemChanges(originalWorkspaceItems, editedWorkspaceItems);
        const hasWorkspaceItemChanges = workspaceItemChanges.added.length > 0 ||
            workspaceItemChanges.updated.length > 0 ||
            workspaceItemChanges.deleted.length > 0 ||
            workspaceItemChanges.reordered.length > 0;

        return hasWorkspaceChanges || hasWorkspaceItemChanges;
    },

    setIsEditing: async (isEditing: boolean) => {
        if (isEditing) {
            // When entering edit mode, reset edit states and refetch data
            
            // Reset all edit states
            set({
                isEditing: false, // Will be set to true after data is loaded
                editedWorkspaces: [],
                editedWorkspaceItems: {},
                originalWorkspaces: [],
                originalWorkspaceItems: {},
                isSaving: false,
                saveError: null
            });
            
            // Refetch latest data from database
            const dataStore = useWorkspaceDataStore.getState();
            await dataStore.reloadAll();
            
            // Get the fresh data
            const { workspaces, workspaceItems } = dataStore;
            
            // Build hierarchical workspaces from fresh data
            const hierarchicalWorkspaces = buildHierarchicalWorkspaces(workspaces, workspaceItems);
            
            // Initialize edit mode with fresh data
            const workspaceItemsMap: Record<string, WorkspaceItem[]> = {};
            
            // Use the existing workspaceItems from the data store, grouped by workspaceId
            workspaceItems.forEach(item => {
                if (!workspaceItemsMap[item.workspaceId]) {
                    workspaceItemsMap[item.workspaceId] = [];
                }
                workspaceItemsMap[item.workspaceId]!.push(item);
            });
            
            set({
                isEditing: true,
                editedWorkspaces: hierarchicalWorkspaces,
                editedWorkspaceItems: workspaceItemsMap,
                originalWorkspaces: hierarchicalWorkspaces,
                originalWorkspaceItems: workspaceItemsMap
            });
            
            // Update the selected workspace to use the edited version
            const workspaceStore = useWorkspaceStore.getState();
            if (workspaceStore.selectedWorkspace) {
                const editedSelectedWorkspace = hierarchicalWorkspaces.find(w => w.id === workspaceStore.selectedWorkspace!.id);
                if (editedSelectedWorkspace) {
                    workspaceStore.setSelectedWorkspace(editedSelectedWorkspace);
                }
            }
            
        } else {
            // When exiting edit mode, just set isEditing to false
            set({ isEditing: false });
        }
    },

    initializeEditMode: (workspaces: WorkspaceWithChildren[], originalWorkspaces?: WorkspaceWithChildren[], originalWorkspaceItems?: Record<string, WorkspaceItem[]>) => {
        // Initialize editedWorkspaceItems with items from each workspace
        const workspaceItems: Record<string, WorkspaceItem[]> = {};
        workspaces.forEach(workspace => {
            workspaceItems[workspace.id] = [...workspace.items];
        });

        // Use provided original data or current data as original
        const originalWs = originalWorkspaces || workspaces;
        const originalItems = originalWorkspaceItems || workspaceItems;

        set({
            isEditing: false, // Always start in non-editing mode
            editedWorkspaces: workspaces,
            editedWorkspaceItems: workspaceItems,
            originalWorkspaces: originalWs,
            originalWorkspaceItems: originalItems
        });
    },

    addWorkspace: (workspace: WorkspaceWithChildren) => {
        set((state) => ({
            editedWorkspaces: [...state.editedWorkspaces, workspace]
        }));
        
        // If this is the first workspace, select it
        const workspaceStore = useWorkspaceStore.getState();
        if (!workspaceStore.selectedWorkspace) {
            workspaceStore.setSelectedWorkspace(workspace);
        }
    },

    addWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => {
        set((state) => ({
            editedWorkspaceItems: {
                ...state.editedWorkspaceItems,
                [workspaceId]: [...(state.editedWorkspaceItems[workspaceId] || []), { ...item, workspaceId }]
            }
        }));
    },

    updateWorkspace: (workspaceId: string, workspace: WorkspaceWithChildren) => {
        
        // Helper function to update workspace in hierarchy
        const updateWorkspaceInHierarchy = (workspaces: WorkspaceWithChildren[]): WorkspaceWithChildren[] => {
            return workspaces.map(w => {
                if (w.id === workspaceId) {
                    return workspace;
                }
                if (w.children.length > 0) {
                    return {
                        ...w,
                        children: updateWorkspaceInHierarchy(w.children)
                    };
                }
                return w;
            });
        };
        
        set((state) => {
            const updatedWorkspaces = updateWorkspaceInHierarchy(state.editedWorkspaces);
            return {
                editedWorkspaces: updatedWorkspaces
            };
        });
        
        // Update the selected workspace if it's the one being updated
        const workspaceStore = useWorkspaceStore.getState();
        if (workspaceStore.selectedWorkspace?.id === workspaceId) {
            workspaceStore.setSelectedWorkspace(workspace);
        }
    },

    updateWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => {
        set((state) => ({
            editedWorkspaceItems: {
                ...state.editedWorkspaceItems,
                [workspaceId]: (state.editedWorkspaceItems[workspaceId] || []).map(w => w.id === item.id ? item : w)
            }
        }));
    },

    deleteWorkspace: (workspaceId: string) => {
        // Helper function to delete workspace from hierarchy
        const deleteWorkspaceFromHierarchy = (workspaces: WorkspaceWithChildren[]): WorkspaceWithChildren[] => {
            return workspaces
                .filter(w => w.id !== workspaceId)
                .map(w => ({
                    ...w,
                    children: w.children.length > 0 ? deleteWorkspaceFromHierarchy(w.children) : []
                }));
        };
        
        set((state) => ({
            editedWorkspaces: deleteWorkspaceFromHierarchy(state.editedWorkspaces)
        }));
    },

    deleteWorkspaceItem: (workspaceId: string, itemId: string) => {
        set((state) => ({
            editedWorkspaceItems: {
                ...state.editedWorkspaceItems,
                [workspaceId]: (state.editedWorkspaceItems[workspaceId] || []).filter(w => w.id !== itemId)
            }
        }));
    },


    reorderWorkspaceItems: (fromId: string, toId: string, type: "before" | "after") => {
        const state = get();
        const editedWorkspaceItems = state.editedWorkspaceItems;

        // Find which workspace contains the items
        let workspaceId: string | null = null;
        let currentItems: WorkspaceItem[] = [];

        for (const [wsId, items] of Object.entries(editedWorkspaceItems)) {
            if (items.some(item => item.id === fromId || item.id === toId)) {
                workspaceId = wsId;
                currentItems = items;
                break;
            }
        }

        if (!workspaceId) {
            return;
        }

        const fromIndex = currentItems.findIndex(w => w.id === fromId)
        const toIndex = currentItems.findIndex(w => w.id === toId)

        if (fromIndex === -1 || toIndex === -1) {
            return
        }

        const newItems = [...currentItems]
        const [movedItem] = newItems.splice(fromIndex, 1)

        if (!movedItem) {
            return
        }

        // Calculate new insert index after removing the moved item
        const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex
        const insertIndex = type === "before" ? adjustedToIndex : adjustedToIndex + 1

        newItems.splice(insertIndex, 0, movedItem)

        // Assign new unique idx values based on final positions
        const updatedItems = newItems.map((item, index) => ({
            ...item,
            idx: index * 10 // Use multiples of 10 to leave room for future insertions
        }))


        set((state) => ({
            editedWorkspaceItems: {
                ...state.editedWorkspaceItems,
                [workspaceId]: updatedItems
            }
        }));
    },

    reorderWorkspace: (fromId: string, toId: string, type: "before" | "after" | "inside") => {
        // Helper function to find workspace in hierarchy
        const findWorkspaceInHierarchy = (workspaces: WorkspaceWithChildren[], id: string): WorkspaceWithChildren | null => {
            for (const workspace of workspaces) {
                if (workspace.id === id) {
                    return workspace;
                }
                if (workspace.children.length > 0) {
                    const found = findWorkspaceInHierarchy(workspace.children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        // Helper function to remove workspace from hierarchy
        const removeWorkspaceFromHierarchy = (workspaces: WorkspaceWithChildren[], id: string): WorkspaceWithChildren[] => {
            return workspaces
                .filter(w => w.id !== id)
                .map(w => ({
                    ...w,
                    children: w.children.length > 0 ? removeWorkspaceFromHierarchy(w.children, id) : []
                }));
        };

        // Helper function to add workspace to hierarchy
        const addWorkspaceToHierarchy = (workspaces: WorkspaceWithChildren[], workspace: WorkspaceWithChildren, targetId: string, type: "before" | "after" | "inside"): WorkspaceWithChildren[] => {
            if (type === "inside") {
                return workspaces.map(w => {
                    if (w.id === targetId) {
                        return {
                            ...w,
                            children: [...w.children, { ...workspace, workspace_parent: targetId }]
                        };
                    }
                    if (w.children.length > 0) {
                        return {
                            ...w,
                            children: addWorkspaceToHierarchy(w.children, workspace, targetId, type)
                        };
                    }
                    return w;
                });
            } else {
                // Find target workspace and add as sibling
                const targetIndex = workspaces.findIndex(w => w.id === targetId);
                if (targetIndex !== -1) {
                    const insertIndex = type === "before" ? targetIndex : targetIndex + 1;
                    const newWorkspaces = [...workspaces];
                    newWorkspaces.splice(insertIndex, 0, workspace);
                    return newWorkspaces;
                } else {
                    // Target not found in current level, search in children
                    return workspaces.map(w => ({
                        ...w,
                        children: w.children.length > 0 ? addWorkspaceToHierarchy(w.children, workspace, targetId, type) : w.children
                    }));
                }
            }
        };

        const currentWorkspaces = get().editedWorkspaces;
        const movedWorkspace = findWorkspaceInHierarchy(currentWorkspaces, fromId);
        const targetWorkspace = findWorkspaceInHierarchy(currentWorkspaces, toId);

        if (!movedWorkspace || !targetWorkspace) {
            return;
        }

        // Prevent moving a workspace into itself
        if (fromId === toId) {
            return;
        }

        // Remove workspace from its current position
        let newWorkspaces = removeWorkspaceFromHierarchy(currentWorkspaces, fromId);

        // Add workspace to new position
        newWorkspaces = addWorkspaceToHierarchy(newWorkspaces, movedWorkspace, toId, type);

        set((state) => ({
            editedWorkspaces: newWorkspaces
        }));

    },

    getEditedWorkspaceItems: (workspaceId: string) => {
        return get().editedWorkspaceItems[workspaceId] || [];
    },

    clearSaveError: () => {
        set({ saveError: null });
    },

    initializeEditModeFromStore: () => {
        const dataStore = useWorkspaceDataStore.getState();
        const { workspaces, workspaceItems } = dataStore;

        // Convert workspaces to hierarchical structure
        const hierarchicalWorkspaces = buildHierarchicalWorkspaces(workspaces, workspaceItems);

        // Initialize editedWorkspaceItems with items from each workspace
        const workspaceItemsMap: Record<string, WorkspaceItem[]> = {};
        hierarchicalWorkspaces.forEach(workspace => {
            workspaceItemsMap[workspace.id] = [...workspace.items];
        });

        set({
            isEditing: false, // Always start in non-editing mode
            editedWorkspaces: hierarchicalWorkspaces,
            editedWorkspaceItems: workspaceItemsMap,
            originalWorkspaces: hierarchicalWorkspaces,
            originalWorkspaceItems: workspaceItemsMap
        });
    }
}))

export const useWorkspace = () => {
    const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceStore()
    const {
        workspaces,
        workspaceItems,
        isLoading,
        error,
        reloadWorkspaces,
        reloadWorkspaceItems,
        reloadAll
    } = useWorkspaceDataStore()

    // Load data when component mounts
    useEffect(() => {
        reloadAll();
    }, []);

    // Restore selected workspace from localStorage when workspaces are loaded
    useEffect(() => {
        if (workspaces.length > 0 && !selectedWorkspace) {
            try {
                const savedWorkspace = localStorage.getItem(STORAGE_KEY);
                if (savedWorkspace) {
                    const parsedWorkspace = JSON.parse(savedWorkspace);
                    // Verify the workspace still exists in the current workspaces
                    const workspaceExists = workspaces.some(w => w.id === parsedWorkspace.id);
                    if (workspaceExists) {
                        setSelectedWorkspace(parsedWorkspace);
                    } else {
                        // Clear invalid workspace from localStorage
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [workspaces, selectedWorkspace, setSelectedWorkspace])

    const hierarchicalWorkspaces = useMemo(() => {
        return buildHierarchicalWorkspaces(workspaces, workspaceItems);
    }, [workspaces, workspaceItems])


    // Helper function to get workspace items for a specific workspace
    const getWorkspaceItems = (workspaceId: string) => {
        return workspaceItems.filter(item => item.workspaceId === workspaceId)
    }

    return {
        selectedWorkspace,
        setSelectedWorkspace,
        hierarchicalWorkspaces,
        workspaces,
        workspaceItems,
        isLoading,
        error,
        reloadWorkspaces,
        reloadWorkspaceItems,
        reloadAll,
        getWorkspaceItems
    }
}