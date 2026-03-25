import { create } from "zustand";
import { useMemo, useEffect } from "react";
import { zodula } from "@/zodula/client";
import {
  useDocListAll,
  useDocListAllStore,
} from "@/zodula/ui/hooks/use-doc-list-all";

// Kept for backward compatibility; no longer used in workspace hierarchy
export interface WorkspaceItem {
  id: string;
  idx?: number | null;
  type?: string | null;
  value?: string | null;
  label?: string | null;
  url?: string | null;
  html?: string | null;
  text?: string | null;
  filters?: string | null;
  heading_level?: string | null;
  badge_variant?: string | null;
  parentid?: string | null;
  parentype?: string | null;
  parentfield?: string | null;
}

export interface WorkspaceWithChildren {
  id: string;
  name: string;
  idx?: number | null;
  workspace_parent?: string | null;
  icon?: string | null;
  app: string | null;
  is_system?: number | null;
  url?: string | null;
  children: WorkspaceWithChildren[];
}

interface WorkspaceState {
  selectedWorkspace: WorkspaceWithChildren | null;
  setSelectedWorkspace: (workspace: WorkspaceWithChildren) => void;
}

interface WorkspaceEditState {
  isEditing: boolean;
  editedWorkspaces: WorkspaceWithChildren[];
  originalWorkspaces: WorkspaceWithChildren[];
  setIsEditing: (isEditing: boolean) => void;
  initializeEditMode: (
    workspaces: WorkspaceWithChildren[],
    originalWorkspaces?: WorkspaceWithChildren[]
  ) => void;
  addWorkspace: (workspace: WorkspaceWithChildren) => void;
  updateWorkspace: (
    workspaceId: string,
    workspace: WorkspaceWithChildren
  ) => void;
  deleteWorkspace: (workspaceId: string) => void;
  reorderWorkspace: (
    fromId: string,
    toId: string,
    type: "before" | "after" | "inside"
  ) => void;
  discardEdit: () => void;
  saveEdit: () => void;
  hasChanges: () => boolean;
  initializeEditModeFromStore: () => void;
}

const STORAGE_KEY = "zodula-selected-workspace";

// Workspace Data Store
interface WorkspaceDataState {
  workspaces: any[];
  isLoading: boolean;
  error: string | null;
  setWorkspaces: (workspaces: any[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWorkspaceDataStore = create<WorkspaceDataState>((set) => ({
  workspaces: [],
  isLoading: false,
  error: null,
  setWorkspaces: (workspaces: any[]) => set({ workspaces }),
  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string | null) => set({ error }),
}));

// Helper: build hierarchical tree from flat list
const buildHierarchicalWorkspaces = (
  workspaces: any[]
): WorkspaceWithChildren[] => {
  const workspaceMap = new Map<string, WorkspaceWithChildren>();

  workspaces.forEach((workspace) => {
    workspaceMap.set(workspace.id, {
      ...workspace,
      children: [],
    });
  });

  const sortedWorkspaces = [...workspaces].sort(
    (a, b) => (a.idx || 0) - (b.idx || 0)
  );

  const rootWorkspaces: WorkspaceWithChildren[] = [];

  sortedWorkspaces.forEach((workspace) => {
    const workspaceWithChildren = workspaceMap.get(workspace.id)!;

    if (workspace.workspace_parent) {
      const parent = workspaceMap.get(workspace.workspace_parent);
      if (parent) {
        parent.children.push(workspaceWithChildren);
      } else {
        rootWorkspaces.push(workspaceWithChildren);
      }
    } else {
      rootWorkspaces.push(workspaceWithChildren);
    }
  });

  rootWorkspaces.forEach((workspace) => {
    workspace.children.sort((a, b) => (a.idx || 0) - (b.idx || 0));
  });

  return rootWorkspaces;
};

// Helper: flatten hierarchical workspaces into a flat array
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

// Helper: detect workspace changes
const detectWorkspaceChanges = (
  original: WorkspaceWithChildren[],
  edited: WorkspaceWithChildren[]
) => {
  const changes = {
    added: [] as WorkspaceWithChildren[],
    updated: [] as WorkspaceWithChildren[],
    deleted: [] as string[],
    reordered: [] as { id: string; newIdx: number | null; oldIdx: number | null }[],
  };

  const originalFlat = flattenWorkspaces(original);
  const editedFlat = flattenWorkspaces(edited);

  const originalMap = new Map(originalFlat.map((w) => [w.id, w]));
  const editedMap = new Map(editedFlat.map((w) => [w.id, w]));

  editedFlat.forEach((editedWorkspace) => {
    const originalWorkspace = originalMap.get(editedWorkspace.id);
    if (!originalWorkspace) {
      changes.added.push(editedWorkspace);
    } else {
      const { children: _oc, ...originalWithout } = originalWorkspace;
      const { children: _ec, ...editedWithout } = editedWorkspace;
      if (JSON.stringify(originalWithout) !== JSON.stringify(editedWithout)) {
        changes.updated.push(editedWorkspace);
      }
      if (originalWorkspace.idx !== editedWorkspace.idx) {
        changes.reordered.push({
          id: editedWorkspace.id,
          newIdx: editedWorkspace.idx ?? null,
          oldIdx: originalWorkspace.idx ?? null,
        });
      }
    }
  });

  originalFlat.forEach((originalWorkspace) => {
    if (!editedMap.has(originalWorkspace.id)) {
      changes.deleted.push(originalWorkspace.id);
    }
  });

  return changes;
};

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedWorkspace: null,
  setSelectedWorkspace: (workspace: WorkspaceWithChildren) => {
    set({ selectedWorkspace: workspace });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch (error) {
      console.warn("Failed to save selected workspace to localStorage:", error);
    }
  },
}));

export const useWorkspaceEdit = create<
  WorkspaceEditState & { isSaving: boolean; saveError: string | null }
>((set, get) => ({
  isEditing: false,
  editedWorkspaces: [],
  originalWorkspaces: [],
  isSaving: false,
  saveError: null,

  saveEdit: async () => {
    const state = get();
    const { editedWorkspaces, originalWorkspaces } = state;

    set({ isSaving: true, saveError: null });

    try {
      const allEditedWorkspaces = flattenWorkspaces(editedWorkspaces);
      const allOriginalWorkspaces = flattenWorkspaces(originalWorkspaces);

      // Normalize idx values by parent group
      const workspacesByParent = new Map<string | null, typeof allEditedWorkspaces>();
      allEditedWorkspaces.forEach((workspace) => {
        const parent = workspace.workspace_parent || null;
        if (!workspacesByParent.has(parent)) {
          workspacesByParent.set(parent, []);
        }
        workspacesByParent.get(parent)!.push(workspace);
      });

      const normalizedWorkspaces = new Map<string, typeof allEditedWorkspaces[0]>();
      workspacesByParent.forEach((workspaces) => {
        workspaces.forEach((workspace, index) => {
          normalizedWorkspaces.set(workspace.id, { ...workspace, idx: index * 10 });
        });
      });

      const workspacesToApply = allEditedWorkspaces.map((workspace) => {
        const normalized = normalizedWorkspaces.get(workspace.id) || workspace;
        return {
          id: workspace.id,
          name: workspace.name,
          idx: normalized.idx ?? 0,
          workspace_parent: workspace.workspace_parent || null,
          icon: workspace.icon || null,
          app: workspace.app || "zodula",
          is_system: workspace.is_system || 0,
          url: workspace.url || null,
          _deleted: false,
        };
      });

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
            url: originalWorkspace.url || null,
            _deleted: true,
          });
        }
      });

      const result = await zodula.action("zodula.core.workspace.apply", {
        data: { workspaces: workspacesToApply },
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to apply workspace changes");
      }

      set({ isEditing: false, isSaving: false, saveError: null });

      const docListAllStore = useDocListAllStore.getState();
      docListAllStore.triggerReload("Workspace");
    } catch (error) {
      console.error("Failed to save workspace changes:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save workspace changes";
      set({ isSaving: false, saveError: errorMessage });
      throw error;
    }
  },

  discardEdit: () => {
    set({
      isEditing: false,
      editedWorkspaces: [],
      originalWorkspaces: [],
    });
    const docListAllStore = useDocListAllStore.getState();
    docListAllStore.triggerReload("Workspace");
  },

  hasChanges: () => {
    const state = get();
    const changes = detectWorkspaceChanges(state.originalWorkspaces, state.editedWorkspaces);
    return (
      changes.added.length > 0 ||
      changes.updated.length > 0 ||
      changes.deleted.length > 0 ||
      changes.reordered.length > 0
    );
  },

  setIsEditing: async (isEditing: boolean) => {
    if (isEditing) {
      set({
        isEditing: false,
        editedWorkspaces: [],
        originalWorkspaces: [],
        isSaving: false,
        saveError: null,
      });

      try {
        const workspacesResponse = await zodula.doc.select_docs("Workspace", {
          limit: 100000,
          filters: [],
          sort: "idx",
          order: "asc",
        });
        const workspaces = workspacesResponse.docs || [];
        const dataStore = useWorkspaceDataStore.getState();
        dataStore.setWorkspaces(workspaces);

        const hierarchicalWorkspaces = buildHierarchicalWorkspaces(workspaces);

        set({
          isEditing: true,
          editedWorkspaces: hierarchicalWorkspaces,
          originalWorkspaces: hierarchicalWorkspaces,
        });

        const workspaceStore = useWorkspaceStore.getState();
        if (workspaceStore.selectedWorkspace) {
          const editedSelected = hierarchicalWorkspaces.find(
            (w) => w.id === workspaceStore.selectedWorkspace!.id
          );
          if (editedSelected) {
            workspaceStore.setSelectedWorkspace(editedSelected);
          }
        }
      } catch (error) {
        console.error("Failed to load workspaces for edit mode:", error);
        set({
          isEditing: false,
          saveError:
            error instanceof Error ? error.message : "Failed to load workspaces",
        });
      }
    } else {
      set({ isEditing: false });
    }
  },

  initializeEditMode: (
    workspaces: WorkspaceWithChildren[],
    originalWorkspaces?: WorkspaceWithChildren[]
  ) => {
    const originalWs = originalWorkspaces || workspaces;
    set({
      isEditing: false,
      editedWorkspaces: workspaces,
      originalWorkspaces: originalWs,
    });
  },

  addWorkspace: (workspace: WorkspaceWithChildren) => {
    set((state) => ({
      editedWorkspaces: [...state.editedWorkspaces, workspace],
    }));
    const workspaceStore = useWorkspaceStore.getState();
    if (!workspaceStore.selectedWorkspace) {
      workspaceStore.setSelectedWorkspace(workspace);
    }
  },

  updateWorkspace: (workspaceId: string, workspace: WorkspaceWithChildren) => {
    const updateInHierarchy = (
      workspaces: WorkspaceWithChildren[]
    ): WorkspaceWithChildren[] => {
      return workspaces.map((w) => {
        if (w.id === workspaceId) return workspace;
        if (w.children.length > 0) {
          return { ...w, children: updateInHierarchy(w.children) };
        }
        return w;
      });
    };

    set((state) => ({
      editedWorkspaces: updateInHierarchy(state.editedWorkspaces),
    }));

    const workspaceStore = useWorkspaceStore.getState();
    if (workspaceStore.selectedWorkspace?.id === workspaceId) {
      workspaceStore.setSelectedWorkspace(workspace);
    }
  },

  deleteWorkspace: (workspaceId: string) => {
    const deleteFromHierarchy = (
      workspaces: WorkspaceWithChildren[]
    ): WorkspaceWithChildren[] => {
      return workspaces
        .filter((w) => w.id !== workspaceId)
        .map((w) => ({
          ...w,
          children: w.children.length > 0 ? deleteFromHierarchy(w.children) : [],
        }));
    };

    set((state) => ({
      editedWorkspaces: deleteFromHierarchy(state.editedWorkspaces),
    }));
  },

  reorderWorkspace: (
    fromId: string,
    toId: string,
    type: "before" | "after" | "inside"
  ) => {
    const findInHierarchy = (
      workspaces: WorkspaceWithChildren[],
      id: string
    ): WorkspaceWithChildren | null => {
      for (const workspace of workspaces) {
        if (workspace.id === id) return workspace;
        if (workspace.children.length > 0) {
          const found = findInHierarchy(workspace.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const removeFromHierarchy = (
      workspaces: WorkspaceWithChildren[],
      id: string
    ): WorkspaceWithChildren[] => {
      return workspaces
        .filter((w) => w.id !== id)
        .map((w) => ({
          ...w,
          children: w.children.length > 0 ? removeFromHierarchy(w.children, id) : [],
        }));
    };

    const addToHierarchy = (
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
              children: [...w.children, { ...workspace, workspace_parent: targetId }],
            };
          }
          if (w.children.length > 0) {
            return { ...w, children: addToHierarchy(w.children, workspace, targetId, type) };
          }
          return w;
        });
      } else {
        const targetIndex = workspaces.findIndex((w) => w.id === targetId);
        if (targetIndex !== -1) {
          const insertIndex = type === "before" ? targetIndex : targetIndex + 1;
          const newWorkspaces = [...workspaces];
          newWorkspaces.splice(insertIndex, 0, workspace);
          return newWorkspaces;
        } else {
          return workspaces.map((w) => ({
            ...w,
            children:
              w.children.length > 0
                ? addToHierarchy(w.children, workspace, targetId, type)
                : w.children,
          }));
        }
      }
    };

    const currentWorkspaces = get().editedWorkspaces;
    const movedWorkspace = findInHierarchy(currentWorkspaces, fromId);
    const targetWorkspace = findInHierarchy(currentWorkspaces, toId);

    if (!movedWorkspace || !targetWorkspace || fromId === toId) return;

    let newWorkspaces = removeFromHierarchy(currentWorkspaces, fromId);
    newWorkspaces = addToHierarchy(newWorkspaces, movedWorkspace, toId, type);

    set({ editedWorkspaces: newWorkspaces });
  },

  initializeEditModeFromStore: () => {
    const dataStore = useWorkspaceDataStore.getState();
    const hierarchicalWorkspaces = buildHierarchicalWorkspaces(dataStore.workspaces);
    set({
      isEditing: false,
      editedWorkspaces: hierarchicalWorkspaces,
      originalWorkspaces: hierarchicalWorkspaces,
    });
  },
}));

export const useWorkspace = () => {
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceStore();

  const {
    docs: allWorkspaces,
    loading: workspacesLoading,
    error: workspacesError,
    reload: reloadWorkspaces,
  } = useDocListAll({
    doctype: "Workspace",
  });

  const workspaces = useMemo(() => {
    return [...allWorkspaces].sort((a, b) => (a.idx || 0) - (b.idx || 0));
  }, [allWorkspaces]);

  const isLoading = workspacesLoading;
  const error = workspacesError;

  // Restore selected workspace from localStorage
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      try {
        const savedWorkspace = localStorage.getItem(STORAGE_KEY);
        if (savedWorkspace) {
          const parsedWorkspace = JSON.parse(savedWorkspace);
          const workspaceExists = workspaces.some((w) => w.id === parsedWorkspace.id);
          if (workspaceExists) {
            setSelectedWorkspace(parsedWorkspace);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [workspaces, selectedWorkspace, setSelectedWorkspace]);

  const hierarchicalWorkspaces = useMemo(() => {
    return buildHierarchicalWorkspaces(workspaces);
  }, [workspaces]);

  return {
    selectedWorkspace,
    setSelectedWorkspace,
    hierarchicalWorkspaces,
    workspaces,
    isLoading,
    error,
    reloadWorkspaces,
    reloadAll: reloadWorkspaces,
  };
};
