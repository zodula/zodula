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

// Zustand store for organization state (single-tenant)
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