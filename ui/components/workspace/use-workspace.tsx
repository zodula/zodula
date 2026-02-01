import { create } from "zustand";
import { useMemo, useEffect } from "react";
import { zodula } from "@/zodula/client";
import {
  useDocListAll,
  useDocListAllStore,
} from "@/zodula/ui/hooks/use-doc-list-all";
import { useOrganization } from "@/zodula/ui/hooks/use-organization";

export interface WorkspaceItem {
  id: string;
  idx?: number | null;
  type?: string | null;
  value?: string | null;
  options?: string | null;
  workspaceId: string;
}

export interface WorkspaceWithChildren {
  id: string;
  name: string;
  idx?: number | null;
  workspace_parent?: string | null;
  icon?: string | null;
  app: string | null;
  is_system?: number | null;
  children: WorkspaceWithChildren[];
  items: WorkspaceItem[];
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
  initializeEditMode: (
    workspaces: WorkspaceWithChildren[],
    originalWorkspaces?: WorkspaceWithChildren[],
    originalWorkspaceItems?: Record<string, WorkspaceItem[]>
  ) => void;
  addWorkspace: (workspace: WorkspaceWithChildren) => void;
  addWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => void;
  updateWorkspace: (
    workspaceId: string,
    workspace: WorkspaceWithChildren
  ) => void;
  updateWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => void;
  deleteWorkspace: (workspaceId: string) => void;
  deleteWorkspaceItem: (workspaceId: string, itemId: string) => void;
  reorderWorkspaceItems: (
    fromId: string,
    toId: string,
    type: "before" | "after"
  ) => void;
  reorderWorkspace: (
    fromId: string,
    toId: string,
    type: "before" | "after" | "inside"
  ) => void;
  getEditedWorkspaceItems: (workspaceId: string) => WorkspaceItem[];

  discardEdit: () => void;
  saveEdit: () => void;
  hasChanges: () => boolean;
  initializeEditModeFromStore: () => void;
}

const STORAGE_KEY = "zodula-selected-workspace";

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
    // This is now handled by useDocListAll hook, kept for backward compatibility
    console.warn(
      "reloadWorkspaces is deprecated. Workspaces are automatically fetched via useDocListAll."
    );
  },

  reloadWorkspaceItems: async () => {
    // This is now handled by useDocListAll hook, kept for backward compatibility
    console.warn(
      "reloadWorkspaceItems is deprecated. Workspace items are automatically fetched via useDocListAll."
    );
  },

  reloadAll: async () => {
    // This is now handled by useDocListAll hooks, kept for backward compatibility
    console.warn(
      "reloadAll is deprecated. Workspaces and workspace items are automatically fetched via useDocListAll."
    );
  },
}));

// Helper function to build hierarchical workspaces
const buildHierarchicalWorkspaces = (
  workspaces: any[],
  workspaceItems: any[]
): WorkspaceWithChildren[] => {
  // Create a map for quick lookup
  const workspaceMap = new Map<string, WorkspaceWithChildren>();

  // Initialize all workspaces with empty children array and items
  workspaces.forEach((workspace) => {
    workspaceMap.set(workspace.id, {
      ...workspace,
      children: [],
      items: [],
    });
  });

  // Group workspace items by workspaceId
  const itemsByWorkspace = new Map<string, WorkspaceItem[]>();
  workspaceItems.forEach((item) => {
    if (!itemsByWorkspace.has(item.workspaceId)) {
      itemsByWorkspace.set(item.workspaceId, []);
    }
    itemsByWorkspace.get(item.workspaceId)!.push(item);
  });

  // Assign items to workspaces
  workspaceMap.forEach((workspace, workspaceId) => {
    const items = itemsByWorkspace.get(workspaceId) || [];
    // Sort items by idx
    workspace.items = items.sort((a, b) => (a.idx || 0) - (b.idx || 0));
  });

  // Sort workspaces by idx first
  const sortedWorkspaces = [...workspaces].sort(
    (a, b) => (a.idx || 0) - (b.idx || 0)
  );

  // Build hierarchy using workspace_parent field
  const rootWorkspaces: WorkspaceWithChildren[] = [];

  sortedWorkspaces.forEach((workspace) => {
    const workspaceWithChildren = workspaceMap.get(workspace.id)!;

    if (workspace.workspace_parent) {
      // This is a child workspace, find its parent
      const parent = workspaceMap.get(workspace.workspace_parent);
      if (parent) {
        parent.children.push(workspaceWithChildren);
      } else {
        // Parent not found, add to root
        rootWorkspaces.push(workspaceWithChildren);
      }
    } else {
      // This is a root workspace (no parent)
      rootWorkspaces.push(workspaceWithChildren);
    }
  });

  // Sort children by idx
  rootWorkspaces.forEach((workspace) => {
    workspace.children.sort((a, b) => (a.idx || 0) - (b.idx || 0));
  });

  return rootWorkspaces;
};

// Helper function to flatten hierarchical workspaces into a flat array
const flattenWorkspaces = (
  workspaces: WorkspaceWithChildren[]
): WorkspaceWithChildren[] => {
  const result: WorkspaceWithChildren[] = [];

  const flatten = (ws: WorkspaceWithChildren[]) => {
    ws.forEach((workspace) => {
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
const detectWorkspaceChanges = (
  original: WorkspaceWithChildren[],
  edited: WorkspaceWithChildren[]
) => {
  const changes = {
    added: [] as WorkspaceWithChildren[],
    updated: [] as WorkspaceWithChildren[],
    deleted: [] as string[],
    reordered: [] as {
      id: string;
      newIdx: number | null;
      oldIdx: number | null;
    }[],
  };

  // Flatten both original and edited to get all workspaces including children
  const originalFlat = flattenWorkspaces(original);
  const editedFlat = flattenWorkspaces(edited);

  // Create maps for easier lookup
  const originalMap = new Map(originalFlat.map((w) => [w.id, w]));
  const editedMap = new Map(editedFlat.map((w) => [w.id, w]));

  // Find added and updated workspaces
  editedFlat.forEach((editedWorkspace) => {
    const originalWorkspace = originalMap.get(editedWorkspace.id);

    if (!originalWorkspace) {
      // New workspace
      changes.added.push(editedWorkspace);
    } else {
      // Check if workspace was updated (compare all properties except children)
      const { children: originalChildren, ...originalWithoutChildren } =
        originalWorkspace;
      const { children: editedChildren, ...editedWithoutChildren } =
        editedWorkspace;

      const isUpdated =
        JSON.stringify(originalWithoutChildren) !==
        JSON.stringify(editedWithoutChildren);
      if (isUpdated) {
        changes.updated.push(editedWorkspace);
      }

      // Check if idx changed (reordering)
      if (originalWorkspace.idx !== editedWorkspace.idx) {
        changes.reordered.push({
          id: editedWorkspace.id,
          newIdx: editedWorkspace.idx ?? null,
          oldIdx: originalWorkspace.idx ?? null,
        });
      }
    }
  });

  // Find deleted workspaces
  originalFlat.forEach((originalWorkspace) => {
    if (!editedMap.has(originalWorkspace.id)) {
      changes.deleted.push(originalWorkspace.id);
    }
  });

  return changes;
};

// Helper function to detect workspace item changes
const detectWorkspaceItemChanges = (
  original: Record<string, WorkspaceItem[]>,
  edited: Record<string, WorkspaceItem[]>
) => {
  const changes = {
    added: [] as WorkspaceItem[],
    updated: [] as WorkspaceItem[],
    deleted: [] as { workspaceId: string; itemId: string }[],
    reordered: [] as {
      workspaceId: string;
      itemId: string;
      newIdx: number | null;
      oldIdx: number | null;
    }[],
  };

  // Get all workspace IDs from both original and edited
  const allWorkspaceIds = new Set([
    ...Object.keys(original),
    ...Object.keys(edited),
  ]);

  allWorkspaceIds.forEach((workspaceId) => {
    const originalItems = original[workspaceId] || [];
    const editedItems = edited[workspaceId] || [];

    // Create maps for easier lookup
    const originalMap = new Map(originalItems.map((item) => [item.id, item]));
    const editedMap = new Map(editedItems.map((item) => [item.id, item]));

    // Find added and updated items
    editedItems.forEach((editedItem) => {
      const originalItem = originalMap.get(editedItem.id);

      if (!originalItem) {
        // New item
        changes.added.push(editedItem);
      } else {
        // Check if item was updated
        const isUpdated =
          JSON.stringify(originalItem) !== JSON.stringify(editedItem);
        if (isUpdated) {
          changes.updated.push(editedItem);
        }

        // Check if idx changed (reordering)
        if (originalItem.idx !== editedItem.idx) {
          changes.reordered.push({
            workspaceId,
            itemId: editedItem.id,
            newIdx: editedItem.idx ?? null,
            oldIdx: originalItem.idx ?? null,
          });
        }
      }
    });

    // Find deleted items
    originalItems.forEach((originalItem) => {
      if (!editedMap.has(originalItem.id)) {
        changes.deleted.push({
          workspaceId,
          itemId: originalItem.id,
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
      console.warn("Failed to save selected workspace to localStorage:", error);
    }
  },
}));

export const useWorkspaceEdit = create<
  WorkspaceEditState & {
    isSaving: boolean;
    saveError: string | null;
  }
>((set, get) => ({
  isEditing: false,
  editedWorkspaces: [],
  editedWorkspaceItems: {},
  originalWorkspaces: [],
  originalWorkspaceItems: {},
  isSaving: false,
  saveError: null,
  saveEdit: async () => {
    const state = get();
    const {
      editedWorkspaces,
      editedWorkspaceItems,
      originalWorkspaces,
      originalWorkspaceItems,
    } = state;

    // Set loading state
    set({ isSaving: true, saveError: null });

    try {
      // Flatten workspaces to include all workspaces (including children)
      const allEditedWorkspaces = flattenWorkspaces(editedWorkspaces);
      const allOriginalWorkspaces = flattenWorkspaces(originalWorkspaces);

      // Create maps for easier lookup
      const originalWorkspaceMap = new Map(
        allOriginalWorkspaces.map((w) => [w.id, w])
      );
      const originalWorkspaceItemMap = new Map<string, WorkspaceItem>();
      Object.values(originalWorkspaceItems)
        .flat()
        .forEach((item) => {
          originalWorkspaceItemMap.set(item.id, item);
        });

      // Prepare workspaces array with _deleted flag
      const workspacesToApply = allEditedWorkspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        idx: workspace.idx || 0,
        workspace_parent: workspace.workspace_parent || null,
        icon: workspace.icon || null,
        app: workspace.app || "zodula",
        is_system: workspace.is_system || 0,
        _deleted: false,
      }));

      // Mark deleted workspaces
      allOriginalWorkspaces.forEach((originalWorkspace) => {
        if (!allEditedWorkspaces.find((w) => w.id === originalWorkspace.id)) {
          workspacesToApply.push({
            id: originalWorkspace.id,
            name: originalWorkspace.name,
            idx: originalWorkspace.idx || 0,
            workspace_parent: originalWorkspace.workspace_parent || null,
            icon: originalWorkspace.icon || null,
            app: originalWorkspace.app || "zodula",
            is_system: originalWorkspace.is_system || 0,
            _deleted: true,
          });
        }
      });

      // Collect all workspace items and normalize idx values
      const allWorkspaceItems: WorkspaceItem[] = [];
      const affectedWorkspaceIds = new Set<string>();

      // Get all items from edited workspace items
      Object.entries(editedWorkspaceItems).forEach(([workspaceId, items]) => {
        affectedWorkspaceIds.add(workspaceId);
        items.forEach((item) => {
          allWorkspaceItems.push(item);
        });
      });

      // Normalize idx values for each workspace to ensure proper sorting
      const normalizedItemsByWorkspace = new Map<string, WorkspaceItem[]>();
      for (const workspaceId of affectedWorkspaceIds) {
        const items = editedWorkspaceItems[workspaceId] || [];
        // Sort items by their current idx values
        const sortedItems = [...items].sort(
          (a, b) => (a.idx || 0) - (b.idx || 0)
        );
        // Reassign idx values sequentially (0, 10, 20, 30, ...)
        const normalizedItems = sortedItems.map((item, index) => ({
          ...item,
          idx: index * 10,
        }));
        normalizedItemsByWorkspace.set(workspaceId, normalizedItems);
      }

      // Prepare workspace items array with _deleted flag
      const workspaceItemsToApply: Array<
        WorkspaceItem & { _deleted?: boolean }
      > = [];

      // Add all edited items (with normalized idx)
      normalizedItemsByWorkspace.forEach((items, workspaceId) => {
        items.forEach((item) => {
          workspaceItemsToApply.push({
            id: item.id,
            idx: item.idx || 0,
            type: item.type || null,
            value: item.value || null,
            options: item.options || null,
            workspaceId: item.workspaceId,
            _deleted: false,
          });
        });
      });

      // Mark deleted items
      // First, collect all workspace IDs that still exist (not deleted)
      const existingWorkspaceIds = new Set(
        allEditedWorkspaces.map((w) => w.id)
      );

      Object.entries(originalWorkspaceItems).forEach(([workspaceId, items]) => {
        // If the workspace itself was deleted, mark all its items as deleted
        const isWorkspaceDeleted = !existingWorkspaceIds.has(workspaceId);
        
        items.forEach((originalItem) => {
          if (isWorkspaceDeleted) {
            // Workspace was deleted, mark all its items as deleted
            workspaceItemsToApply.push({
              id: originalItem.id,
              idx: originalItem.idx || 0,
              type: originalItem.type || null,
              value: originalItem.value || null,
              options: originalItem.options || null,
              workspaceId: originalItem.workspaceId,
              _deleted: true,
            });
          } else {
            // Workspace still exists, check if item was deleted
            const editedItems = normalizedItemsByWorkspace.get(workspaceId) || [];
            if (!editedItems.find((item) => item.id === originalItem.id)) {
              workspaceItemsToApply.push({
                id: originalItem.id,
                idx: originalItem.idx || 0,
                type: originalItem.type || null,
                value: originalItem.value || null,
                options: originalItem.options || null,
                workspaceId: originalItem.workspaceId,
                _deleted: true,
              });
            }
          }
        });
      });

      // Call the apply action with all workspaces and items
      const result = await zodula.action("zodula.core.workspace.apply", {
        data: {
          workspaces: workspacesToApply,
          workspaceItems: workspaceItemsToApply,
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to apply workspace changes");
      }

      // Reset editing state and clear loading
      set({ isEditing: false, isSaving: false, saveError: null });

      // Trigger reload of workspaces and workspace items
      const docListAllStore = useDocListAllStore.getState();
      docListAllStore.triggerReload("zodula__Workspace");
      docListAllStore.triggerReload("zodula__Workspace Item");
    } catch (error) {
      console.error("Failed to save workspace changes:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save workspace changes";
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
      originalWorkspaceItems: {},
    });

    // Trigger reload of workspaces and workspace items
    // This ensures we have the latest data after discarding changes
    const docListAllStore = useDocListAllStore.getState();
    docListAllStore.triggerReload("zodula__Workspace");
    docListAllStore.triggerReload("zodula__Workspace Item");
  },

  hasChanges: () => {
    const state = get();
    const {
      editedWorkspaces,
      editedWorkspaceItems,
      originalWorkspaces,
      originalWorkspaceItems,
    } = state;

    // Check for workspace changes
    const workspaceChanges = detectWorkspaceChanges(
      originalWorkspaces,
      editedWorkspaces
    );
    const hasWorkspaceChanges =
      workspaceChanges.added.length > 0 ||
      workspaceChanges.updated.length > 0 ||
      workspaceChanges.deleted.length > 0 ||
      workspaceChanges.reordered.length > 0;

    // Check for workspace item changes
    const workspaceItemChanges = detectWorkspaceItemChanges(
      originalWorkspaceItems,
      editedWorkspaceItems
    );
    const hasWorkspaceItemChanges =
      workspaceItemChanges.added.length > 0 ||
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
        saveError: null,
      });

      // Refetch latest data from database directly
      try {
        // Fetch workspaces
        const workspacesResponse = await zodula.doc.select_docs(
          "zodula__Workspace",
          {
            limit: 100000,
            filters: [],
            sort: "idx",
            order: "asc",
          }
        );
        const workspaces = workspacesResponse.docs || [];

        // Fetch workspace items
        const workspaceItemsResponse = await zodula.doc.select_docs(
          "zodula__Workspace Item",
          {
            limit: 100000,
            filters: [],
            sort: "idx",
            order: "asc",
          }
        );
        const workspaceItems = workspaceItemsResponse.docs || [];

        // Update the data store
        const dataStore = useWorkspaceDataStore.getState();
        dataStore.setWorkspaces(workspaces);
        dataStore.setWorkspaceItems(workspaceItems);

        // Build hierarchical workspaces from fresh data
        const hierarchicalWorkspaces = buildHierarchicalWorkspaces(
          workspaces,
          workspaceItems
        );

        // Initialize edit mode with fresh data
        const workspaceItemsMap: Record<string, WorkspaceItem[]> = {};

        // Use the existing workspaceItems from the data store, grouped by workspaceId
        workspaceItems.forEach((item) => {
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
          originalWorkspaceItems: workspaceItemsMap,
        });

        // Update the selected workspace to use the edited version
        const workspaceStore = useWorkspaceStore.getState();
        if (workspaceStore.selectedWorkspace) {
          const editedSelectedWorkspace = hierarchicalWorkspaces.find(
            (w) => w.id === workspaceStore.selectedWorkspace!.id
          );
          if (editedSelectedWorkspace) {
            workspaceStore.setSelectedWorkspace(editedSelectedWorkspace);
          }
        }
      } catch (error) {
        console.error("Failed to load workspaces for edit mode:", error);
        set({
          isEditing: false,
          saveError:
            error instanceof Error
              ? error.message
              : "Failed to load workspaces",
        });
      }
    } else {
      // When exiting edit mode, just set isEditing to false
      set({ isEditing: false });
    }
  },

  initializeEditMode: (
    workspaces: WorkspaceWithChildren[],
    originalWorkspaces?: WorkspaceWithChildren[],
    originalWorkspaceItems?: Record<string, WorkspaceItem[]>
  ) => {
    // Initialize editedWorkspaceItems with items from each workspace
    const workspaceItems: Record<string, WorkspaceItem[]> = {};
    workspaces.forEach((workspace) => {
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
      originalWorkspaceItems: originalItems,
    });
  },

  addWorkspace: (workspace: WorkspaceWithChildren) => {
    set((state) => ({
      editedWorkspaces: [...state.editedWorkspaces, workspace],
    }));

    // If this is the first workspace, select it
    const workspaceStore = useWorkspaceStore.getState();
    if (!workspaceStore.selectedWorkspace) {
      workspaceStore.setSelectedWorkspace(workspace);
    }
  },

  addWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => {
    set((state) => {
      const currentItems = state.editedWorkspaceItems[workspaceId] || [];
      // Sort items by idx to ensure proper ordering
      const sortedItems = [...currentItems].sort(
        (a, b) => (a.idx || 0) - (b.idx || 0)
      );

      let newItem = { ...item, workspaceId };

      // Calculate idx if not provided - insert at the end
      if (newItem.idx === undefined || newItem.idx === null) {
        if (sortedItems.length === 0) {
          newItem.idx = 0;
        } else {
          const lastIdx = sortedItems[sortedItems.length - 1]?.idx || 0;
          newItem.idx = lastIdx + 10; // Add 10 to leave room for future insertions
        }
      } else {
        // Item has a specific idx - shift other items to make room
        const insertIdx = newItem.idx;
        const updatedItems = sortedItems.map((existingItem) => {
          if (
            existingItem.idx !== null &&
            existingItem.idx !== undefined &&
            existingItem.idx >= insertIdx
          ) {
            // Shift items with idx >= insertIdx
            return {
              ...existingItem,
              idx: existingItem.idx + 10,
            };
          }
          return existingItem;
        });

        // Insert the new item
        updatedItems.push(newItem);
        // Sort again to ensure proper order
        updatedItems.sort((a, b) => (a.idx || 0) - (b.idx || 0));

        return {
          editedWorkspaceItems: {
            ...state.editedWorkspaceItems,
            [workspaceId]: updatedItems,
          },
        };
      }

      // Add item at the end if idx was calculated
      const updatedItems = [...sortedItems, newItem];
      updatedItems.sort((a, b) => (a.idx || 0) - (b.idx || 0));

      return {
        editedWorkspaceItems: {
          ...state.editedWorkspaceItems,
          [workspaceId]: updatedItems,
        },
      };
    });
  },

  updateWorkspace: (workspaceId: string, workspace: WorkspaceWithChildren) => {
    // Helper function to update workspace in hierarchy
    const updateWorkspaceInHierarchy = (
      workspaces: WorkspaceWithChildren[]
    ): WorkspaceWithChildren[] => {
      return workspaces.map((w) => {
        if (w.id === workspaceId) {
          return workspace;
        }
        if (w.children.length > 0) {
          return {
            ...w,
            children: updateWorkspaceInHierarchy(w.children),
          };
        }
        return w;
      });
    };

    set((state) => {
      const updatedWorkspaces = updateWorkspaceInHierarchy(
        state.editedWorkspaces
      );
      return {
        editedWorkspaces: updatedWorkspaces,
      };
    });

    // Update the selected workspace if it's the one being updated
    const workspaceStore = useWorkspaceStore.getState();
    if (workspaceStore.selectedWorkspace?.id === workspaceId) {
      workspaceStore.setSelectedWorkspace(workspace);
    }
  },

  updateWorkspaceItem: (workspaceId: string, item: WorkspaceItem) => {
    set((state) => {
      const currentItems = state.editedWorkspaceItems[workspaceId] || [];
      const updatedItems = currentItems.map((w) =>
        w.id === item.id ? item : w
      );

      // If idx changed, we may need to shift other items
      const oldItem = currentItems.find((w) => w.id === item.id);
      if (
        oldItem &&
        oldItem.idx !== item.idx &&
        item.idx !== null &&
        item.idx !== undefined
      ) {
        // Item's idx changed - shift other items if needed
        const insertIdx = item.idx;
        const shiftedItems = updatedItems.map((existingItem) => {
          if (existingItem.id === item.id) {
            return item; // This is the updated item
          }
          // Shift items that are at or after the new position
          if (
            existingItem.idx !== null &&
            existingItem.idx !== undefined &&
            existingItem.idx >= insertIdx
          ) {
            return {
              ...existingItem,
              idx: existingItem.idx + 10,
            };
          }
          return existingItem;
        });

        // Sort by idx to maintain order
        shiftedItems.sort((a, b) => (a.idx || 0) - (b.idx || 0));

        return {
          editedWorkspaceItems: {
            ...state.editedWorkspaceItems,
            [workspaceId]: shiftedItems,
          },
        };
      }

      // No idx change, just update the item and sort
      updatedItems.sort((a, b) => (a.idx || 0) - (b.idx || 0));

      return {
        editedWorkspaceItems: {
          ...state.editedWorkspaceItems,
          [workspaceId]: updatedItems,
        },
      };
    });
  },

  deleteWorkspace: (workspaceId: string) => {
    // Helper function to delete workspace from hierarchy
    const deleteWorkspaceFromHierarchy = (
      workspaces: WorkspaceWithChildren[]
    ): WorkspaceWithChildren[] => {
      return workspaces
        .filter((w) => w.id !== workspaceId)
        .map((w) => ({
          ...w,
          children:
            w.children.length > 0
              ? deleteWorkspaceFromHierarchy(w.children)
              : [],
        }));
    };

    set((state) => {
      // Remove workspace items associated with this workspace
      const updatedWorkspaceItems = { ...state.editedWorkspaceItems };
      delete updatedWorkspaceItems[workspaceId];

      return {
        editedWorkspaces: deleteWorkspaceFromHierarchy(state.editedWorkspaces),
        editedWorkspaceItems: updatedWorkspaceItems,
      };
    });
  },

  deleteWorkspaceItem: (workspaceId: string, itemId: string) => {
    set((state) => ({
      editedWorkspaceItems: {
        ...state.editedWorkspaceItems,
        [workspaceId]: (state.editedWorkspaceItems[workspaceId] || []).filter(
          (w) => w.id !== itemId
        ),
      },
    }));
  },

  reorderWorkspaceItems: (
    fromId: string,
    toId: string,
    type: "before" | "after"
  ) => {
    const state = get();
    const editedWorkspaceItems = state.editedWorkspaceItems;

    // Find which workspace contains the items
    let workspaceId: string | null = null;
    let currentItems: WorkspaceItem[] = [];

    for (const [wsId, items] of Object.entries(editedWorkspaceItems)) {
      if (items.some((item) => item.id === fromId || item.id === toId)) {
        workspaceId = wsId;
        currentItems = items;
        break;
      }
    }

    if (!workspaceId) {
      return;
    }

    const fromIndex = currentItems.findIndex((w) => w.id === fromId);
    const toIndex = currentItems.findIndex((w) => w.id === toId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const newItems = [...currentItems];
    const [movedItem] = newItems.splice(fromIndex, 1);

    if (!movedItem) {
      return;
    }

    // Calculate new insert index after removing the moved item
    const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    const insertIndex =
      type === "before" ? adjustedToIndex : adjustedToIndex + 1;

    newItems.splice(insertIndex, 0, movedItem);

    // Assign new unique idx values based on final positions
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      idx: index * 10, // Use multiples of 10 to leave room for future insertions
    }));

    set((state) => ({
      editedWorkspaceItems: {
        ...state.editedWorkspaceItems,
        [workspaceId]: updatedItems,
      },
    }));
  },

  reorderWorkspace: (
    fromId: string,
    toId: string,
    type: "before" | "after" | "inside"
  ) => {
    // Helper function to find workspace in hierarchy
    const findWorkspaceInHierarchy = (
      workspaces: WorkspaceWithChildren[],
      id: string
    ): WorkspaceWithChildren | null => {
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
    const removeWorkspaceFromHierarchy = (
      workspaces: WorkspaceWithChildren[],
      id: string
    ): WorkspaceWithChildren[] => {
      return workspaces
        .filter((w) => w.id !== id)
        .map((w) => ({
          ...w,
          children:
            w.children.length > 0
              ? removeWorkspaceFromHierarchy(w.children, id)
              : [],
        }));
    };

    // Helper function to add workspace to hierarchy
    const addWorkspaceToHierarchy = (
      workspaces: WorkspaceWithChildren[],
      workspace: WorkspaceWithChildren,
      targetId: string,
      type: "before" | "after" | "inside"
    ): WorkspaceWithChildren[] => {
      if (type === "inside") {
        return workspaces.map((w) => {
          if (w.id === targetId) {
            return {
              ...w,
              children: [
                ...w.children,
                { ...workspace, workspace_parent: targetId },
              ],
            };
          }
          if (w.children.length > 0) {
            return {
              ...w,
              children: addWorkspaceToHierarchy(
                w.children,
                workspace,
                targetId,
                type
              ),
            };
          }
          return w;
        });
      } else {
        // Find target workspace and add as sibling
        const targetIndex = workspaces.findIndex((w) => w.id === targetId);
        if (targetIndex !== -1) {
          const insertIndex = type === "before" ? targetIndex : targetIndex + 1;
          const newWorkspaces = [...workspaces];
          newWorkspaces.splice(insertIndex, 0, workspace);
          return newWorkspaces;
        } else {
          // Target not found in current level, search in children
          return workspaces.map((w) => ({
            ...w,
            children:
              w.children.length > 0
                ? addWorkspaceToHierarchy(w.children, workspace, targetId, type)
                : w.children,
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
    newWorkspaces = addWorkspaceToHierarchy(
      newWorkspaces,
      movedWorkspace,
      toId,
      type
    );

    set((state) => ({
      editedWorkspaces: newWorkspaces,
    }));
  },

  getEditedWorkspaceItems: (workspaceId: string) => {
    const items = get().editedWorkspaceItems[workspaceId] || [];
    // Always return items sorted by idx
    return [...items].sort((a, b) => (a.idx || 0) - (b.idx || 0));
  },

  clearSaveError: () => {
    set({ saveError: null });
  },

  initializeEditModeFromStore: () => {
    const dataStore = useWorkspaceDataStore.getState();
    const { workspaces, workspaceItems } = dataStore;

    // Convert workspaces to hierarchical structure
    const hierarchicalWorkspaces = buildHierarchicalWorkspaces(
      workspaces,
      workspaceItems
    );

    // Initialize editedWorkspaceItems with items from each workspace
    const workspaceItemsMap: Record<string, WorkspaceItem[]> = {};
    hierarchicalWorkspaces.forEach((workspace) => {
      workspaceItemsMap[workspace.id] = [...workspace.items];
    });

    set({
      isEditing: false, // Always start in non-editing mode
      editedWorkspaces: hierarchicalWorkspaces,
      editedWorkspaceItems: workspaceItemsMap,
      originalWorkspaces: hierarchicalWorkspaces,
      originalWorkspaceItems: workspaceItemsMap,
    });
  },
}));

export const useWorkspace = () => {
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceStore();
  const { organization } = useOrganization();

  // Fetch all workspaces and workspace items with persistent caching
  const {
    docs: allWorkspaces,
    loading: workspacesLoading,
    error: workspacesError,
    reload: reloadWorkspaces,
  } = useDocListAll({
    doctype: "zodula__Workspace",
  });

  const {
    docs: allWorkspaceItems,
    loading: itemsLoading,
    error: itemsError,
    reload: reloadWorkspaceItems,
  } = useDocListAll({
    doctype: "zodula__Workspace Item",
  });

  // Filter and sort workspaces based on organization
  // is_system workspaces should only show in System Organization
  const workspaces = useMemo(() => {
    const isSystemOrg = organization?.id === "SYS";
    
    const filtered = allWorkspaces.filter((workspace) => {
      // If workspace is system, only show in System Organization
      if (workspace.is_system === 1) {
        return isSystemOrg;
      }
      // Non-system workspaces show in all organizations
      return true;
    });
    
    return filtered.sort((a, b) => (a.idx || 0) - (b.idx || 0));
  }, [allWorkspaces, organization]);

  // Filter workspace items to only include items from visible workspaces
  const workspaceItems = useMemo(() => {
    const visibleWorkspaceIds = new Set(workspaces.map((w) => w.id));
    const filtered = allWorkspaceItems.filter((item) =>
      visibleWorkspaceIds.has(item.workspaceId)
    );
    return filtered.sort((a, b) => (a.idx || 0) - (b.idx || 0));
  }, [allWorkspaceItems, workspaces]);

  const isLoading = workspacesLoading || itemsLoading;
  const error = workspacesError || itemsError;

  // Reload all function
  const reloadAll = () => {
    reloadWorkspaces();
    reloadWorkspaceItems();
  };

  // Restore selected workspace from localStorage when workspaces are loaded
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      try {
        const savedWorkspace = localStorage.getItem(STORAGE_KEY);
        if (savedWorkspace) {
          const parsedWorkspace = JSON.parse(savedWorkspace);
          // Verify the workspace still exists in the current workspaces
          const workspaceExists = workspaces.some(
            (w) => w.id === parsedWorkspace.id
          );
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
  }, [workspaces, selectedWorkspace, setSelectedWorkspace]);

  const hierarchicalWorkspaces = useMemo(() => {
    return buildHierarchicalWorkspaces(workspaces, workspaceItems);
  }, [workspaces, workspaceItems]);

  // Helper function to get workspace items for a specific workspace
  const getWorkspaceItems = (workspaceId: string) => {
    return workspaceItems.filter((item) => item.workspaceId === workspaceId);
  };

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
    getWorkspaceItems,
  };
};
