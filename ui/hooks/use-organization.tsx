import { createContext, useContext, useState, type ReactNode } from "react";

interface OrganizationContextValue {
  organization: Zodula.SelectDoctype<"zodula__Organization"> | null;
  loading: boolean;
  error: string | null;
  setOrganization: (org: Zodula.SelectDoctype<"zodula__Organization"> | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined
);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [organization, setOrganization] = useState<Zodula.SelectDoctype<"zodula__Organization"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value: OrganizationContextValue = {
    organization,
    loading,
    error,
    setOrganization,
    setLoading,
    setError,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
