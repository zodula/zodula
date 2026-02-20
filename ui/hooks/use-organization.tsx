import { create } from 'zustand';
import { useDoc } from './use-doc';

interface OrganizationState {
  organization: Zodula.SelectDoctype<"Organization"> | null;
  loading: boolean;
  error: string | null;
  setOrganization: (org: Zodula.SelectDoctype<"Organization"> | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Zustand store for organization state (accessible without hooks)
export const useOrganizationStore = create<OrganizationState>((set) => ({
  organization: null,
  loading: false,
  error: null,
  setOrganization: (org) => set({ organization: org }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// Hook for React components (subscribes to store changes)
export function useOrganization() {
  return useOrganizationStore();
}

/** Fetches organization doc by id. Use when you need the organization for a specific id (e.g. formData.organization). */
export function useOrganizationById(id: string | null | undefined) {
  const { doc, loading, error } = useDoc(
    {
      doctype: 'Organization',
      id: id ?? '',
    },
    [id ?? '']
  );
  return { organization: doc, loading, error };
}

// Get organization ID directly from store (for use outside React components)
export function getOrganizationId(): string | null {
  const state = useOrganizationStore.getState();
  return state.organization?.id || null;
}
