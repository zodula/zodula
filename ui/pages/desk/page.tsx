import React, { useState, useEffect } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { useAction } from "@/zodula/ui/hooks/use-action";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { Button } from "@/zodula/ui/components/ui/button";
import { FileText, Plus, ChevronRight, BuildingIcon } from "lucide-react";
import { zodula } from "@/zodula/client";
import { popup } from "@/zodula/ui/components/ui/popit";
import { CreateOrganizationDialog } from "../../components/dialogs/create-organization-dialog";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/use-translation";

const STORAGE_KEY = "zodula-selected-organization";

const tierLevelLabels = {
  "0": "Free",
  "1": "Basic",
  "2": "Pro",
  "3": "Enterprise",
  "4": "Enterprise Plus",
  "5": "Enterprise Pro",
}

export default function DeskPage() {
  const { push, pathname } = useRouter();
  const { user } = useAuth();
  const { doc: globalSetting } = useDocAll({
    doctype: "Global Setting",
    id: "Global Setting"
  });
  const { t } = useTranslation();

  // Load organizations using action
  const { data: organizationsResponse, reload: reloadOrganizations } = useAction(
    "zodula.org.list",
    {},
    []
  );

  // Extract organizations from response
  const organizations: Zodula.SelectDoctype<"Organization">[] = organizationsResponse?.data || [];

  // Get selected organization from localStorage
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedOrgId(saved);
      }
    } catch (error) {
      console.warn("Failed to load selected organization:", error);
    }
  }, []);

  const handleCreateOrganization = async () => {
    try {
      const result = await popup(
        CreateOrganizationDialog,
        {
          title: "Create Organization",
          description: "Create a new organization",
        },
        {}
      );
      if (result?.id) {
        await reloadOrganizations();
        // Navigate to the newly created organization
        push(`/desk/${result.id}`);
      }
    } catch (error) {
      console.error("Error creating organization:", error);
    }
  };

  const handleSelectOrganization = (orgId: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, orgId);
      setSelectedOrgId(orgId);
    } catch (error) {
      console.warn("Failed to save selected organization:", error);
    }
    push(`/desk/${orgId}`);
  };

  const logoUrl = globalSetting?.logo
    ? zodula.utils.getDoctypeFileUrl(
        "Global Setting",
        globalSetting?.id || "",
        "logo",
        (globalSetting?.logo as string) || "",
        "System Panel"
      ) + "?w=40&h=40"
    : "/public/zodula/zodula-logo.png";

  return (
    <div className="zd:min-h-screen zd:flex zd:flex-col zd:bg-background">
      {/* Header */}
      <header className="zd:flex zd:items-center zd:justify-between zd:px-6 zd:py-4 zd:border-b">
        <div className="zd:flex zd:items-center zd:gap-2">
          <img
            src={logoUrl}
            alt="Logo"
            className="zd:w-10 zd:h-10 zd:rounded"
          />
        </div>
        {user && (
          <div className="zd:flex zd:items-center zd:gap-2 zd:text-foreground">
            <span>{user.name || user.email}</span>
            <ChevronRight className="zd:w-4 zd:h-4" />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="zd:flex-1 zd:flex zd:items-center zd:justify-center zd:p-8">
        <div className="zd:w-full zd:max-w-md zd:space-y-6">
          {/* Heading */}
          <div className="zd:text-center zd:space-y-2">
            <h1 className="zd:text-3xl zd:font-bold zd:text-foreground">
              {t("Select Company")}
            </h1>
            <p className="zd:text-sm zd:text-muted-foreground">
              {t("Select the company you want to use")}
            </p>
          </div>

          {/* Organization List */}
          <div className="zd:space-y-3">
            {organizations.map((org) => {
              const isSelected = selectedOrgId === org?.id;
              return (
                <button
                  key={org?.id}
                  onClick={() => handleSelectOrganization(org?.id)}
                  className={cn(
                    "zd:w-full zd:flex zd:items-center zd:gap-4 zd:p-4 zd:rounded-lg zd:border zd:bg-background",
                    "zd:hover:bg-accent zd:hover:border-accent zd:transition-colors zd:cursor-pointer",
                    "zd:text-left",
                    isSelected 
                      ? "zd:border-primary zd:bg-accent" 
                      : "zd:border-input"
                  )}
                >
                  <BuildingIcon className="zd:w-5 zd:h-5 zd:text-muted-foreground zd:flex-shrink-0" />
                  <div className="zd:flex-1 zd:min-w-0">
                    <div className="zd:font-medium zd:text-foreground zd:truncate">
                      {org?.name || org?.id}
                    </div>
                    <div className="zd:text-sm zd:text-muted-foreground">
                      {t(tierLevelLabels[org?.tier_level as keyof typeof tierLevelLabels] || "Free")}
                    </div>
                  </div>
                  <ChevronRight className="zd:w-5 zd:h-5 zd:text-muted-foreground zd:flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Create New Company Button */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleCreateOrganization}
            className="zd:w-full zd:flex zd:items-center zd:gap-2 zd:justify-start"
          >
            <Plus className="zd:w-4 zd:h-4" />
            <span>{t("Create New Company")}</span>
          </Button>
        </div>
      </main>
    </div>
  );
}

