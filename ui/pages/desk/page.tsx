import React, { useState, useEffect } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { useAction } from "@/zodula/ui/hooks/use-action";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { Button } from "@/zodula/ui/components/ui/button";
import { Plus, ChevronRight, Building2, Layers } from "lucide-react";
import { zodula } from "@/zodula/client";
import { confirm, popup } from "@/zodula/ui/components/ui/popit";
import { OrganizationSelectNavbar } from "@/zodula/ui/components/custom/organization-select-navbar";
import { CreateOrganizationDialog } from "../../components/dialogs/create-organization-dialog";
import { AppTierPopup } from "../../components/dialogs/app-tier-popup";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/use-translation";

const STORAGE_KEY = "zodula-selected-organization";

export default function DeskPage() {
  const { push } = useRouter();
  const { user, logout } = useAuth();
  const { doc: globalSetting } = useDocAll({
    doctype: "Global Setting",
    id: "Global Setting"
  });
  const { t } = useTranslation();

  const { data: organizationsResponse, reload: reloadOrganizations } = useAction(
    "zodula.org.list",
    {},
    []
  );

  const organizations: Zodula.SelectDoctype<"Organization">[] = organizationsResponse?.data || [];
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedOrgId(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const handleCreateOrganization = async () => {
    try {
      const result = await popup(
        CreateOrganizationDialog,
        { title: "Create Organization", description: "Create a new organization. These cannot be changed later." },
        {}
      );
      if (result?.id) {
        await reloadOrganizations();
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
    } catch {
      /* ignore */
    }
    push(`/desk/${orgId}`);
  };

  const handleShowAppTier = async (e: React.MouseEvent, org: Zodula.SelectDoctype<"Organization">) => {
    e.stopPropagation();
    await popup(
      AppTierPopup,
      { title: t("App Tier"), description: org?.unique_name || org?.id },
      { orgId: org?.id ?? "", orgUniqueName: org?.unique_name ?? org?.id }
    );
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: t("Logout"),
      message: t("Are you sure you want to logout?"),
      confirmText: t("Logout"),
      cancelText: t("Cancel"),
      variant: "destructive",
    });
    if (confirmed) await logout();
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
    <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
      <OrganizationSelectNavbar
        logoUrl={logoUrl}
        userDisplayName={user?.name || user?.email}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="zd:flex-1 zd:flex zd:items-center zd:justify-center zd:p-6 zd:pt-20 zd:relative zd:z-10">
        <div className="zd:w-full zd:max-w-md zd:flex zd:flex-col zd:gap-6 zd:rounded-xl zd:border zd:bg-background/95 zd:backdrop-blur-sm zd:shadow-lg zd:shadow-black/5 zd:p-6">
          <div className="zd:text-center zd:space-y-1">
            <h1 className="zd:text-2xl zd:font-semibold zd:text-foreground">
              {t("Select Company")}
            </h1>
            <p className="zd:text-sm zd:text-muted-foreground">
              {t("Select the company you want to use")}
            </p>
          </div>

          {/* Organization List */}
          <div className="zd:space-y-2">
            {organizations.length === 0 ? (
              <div className="zd:rounded-lg zd:border zd:border-dashed zd:border-muted-foreground/25 zd:bg-muted/30 zd:py-10 zd:px-4 zd:text-center">
                <Building2 className="zd:w-12 zd:h-12 zd:mx-auto zd:text-muted-foreground/60 zd:mb-3" />
                <p className="zd:text-sm zd:text-muted-foreground zd:mb-1">{t("No companies yet")}</p>
                <p className="zd:text-xs zd:text-muted-foreground">{t("Create your first company to get started")}</p>
              </div>
            ) : (
              organizations.map((org) => {
                const isSelected = selectedOrgId === org?.id;
                return (
                  <div
                    key={org?.id}
                    className={cn(
                      "zd:group zd:w-full zd:flex zd:items-center zd:gap-4 zd:p-4 zd:rounded-lg zd:border",
                      "zd:transition-all zd:duration-200",
                      "zd:hover:shadow-md zd:hover:border-primary/30",
                      isSelected
                        ? "zd:border-primary zd:bg-primary/5 zd:shadow-sm"
                        : "zd:border-input zd:bg-background zd:hover:bg-accent/50"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectOrganization(org?.id)}
                      className="zd:flex-1 zd:flex zd:items-center zd:gap-4 zd:text-left zd:min-w-0 zd:cursor-pointer"
                    >
                      <div className="zd:flex zd:items-center zd:justify-center zd:w-10 zd:h-10 zd:rounded-lg zd:bg-muted zd:flex-shrink-0 zd:group-hover:bg-muted/80">
                        <Building2 className="zd:w-5 zd:h-5 zd:text-muted-foreground" />
                      </div>
                      <div className="zd:flex-1 zd:min-w-0">
                        <div className="zd:font-medium zd:text-foreground zd:truncate">
                          {org?.unique_name || org?.id}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "zd:w-5 zd:h-5 zd:flex-shrink-0 zd:transition-transform",
                        isSelected ? "zd:text-primary" : "zd:text-muted-foreground"
                      )} />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleShowAppTier(e, org)}
                      className="zd:flex-shrink-0 zd:text-muted-foreground zd:hover:text-foreground"
                      title={t("App Tier")}
                    >
                      <Layers className="zd:w-4 zd:h-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Create New Company */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleCreateOrganization}
            className="zd:w-full zd:border-dashed zd:hover:border-solid zd:hover:border-primary/50 zd:hover:bg-primary/5"
          >
            <Plus className="zd:w-4 zd:h-4" />
            {t("Create New Company")}
          </Button>
        </div>
      </main>
    </div>
  );
}

