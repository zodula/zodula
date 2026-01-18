import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useParams } from "react-router";
import { useDoc } from "./use-doc";
import { useRouter } from "../components/router";

interface OrganizationContextValue {
  organization: Zodula.SelectDoctype<"zodula__Organization"> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined
);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();

  const {
    doc: organization,
    loading,
    error,
    reload,
  } = useDoc(
    {
      doctype: "zodula__Organization",
      id: org,
    },
    [org]
  );

  useEffect(() => {
    // If we have an org param but failed to fetch or got an error, redirect to /desk
    // Only redirect if we're not currently loading and either there's an error or no organization found
    if (!!org && !loading) {
      if (!!error || !organization) {
        // router.replace("/desk");
      }
      if (org) {
        localStorage.setItem("zodula-selected-organization", org);
      }
    }
  }, [org, loading, error, organization, router]);

  const value: OrganizationContextValue = {
    organization,
    loading,
    error,
    reload,
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
