import { Link } from "react-router";
import { Select, type SelectOption } from "../ui/select";
import { useEffect, useState, useMemo } from "react";
import { zodula } from "@/zodula/client";
import { useRouter } from "../router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { PlusIcon, UserIcon, InfoIcon, FileIcon, BookIcon, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useDocAll } from "../../hooks/use-doc-all";
import { useDocListAll } from "../../hooks/use-doc-list-all";
import { useTranslation } from "../../hooks/use-translation";
import { AboutZodulaDialog } from "../dialogs/about-zodula-dialog";
import { confirm, popup } from "../ui/popit";
import { useNavbar } from "../../hooks/use-navbar";
import { cn } from "../../lib/utils";
import { LanguageSelection } from "./language-selection";
import { Breadcrumb } from "./breadcrumb";
import { useOrganization } from "../../hooks/use-organization";

export interface NavbarProps {
  children?: React.ReactNode;
}

export const Navbar = ({ children }: NavbarProps) => {
  const { doc: WebsiteSetting } = useDocAll({
    doctype: "Global Setting",
    id: "Global Setting"
  });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { fullWidth, setFullWidth, toggleFullWidth } = useNavbar();
  const { t } = useTranslation();

  // Fetch all doctypes and pages with persistent caching, then filter client-side
  const { docs: allDoctypes } = useDocListAll({
    doctype: "Doctype"
  });

  const { docs: allPages } = useDocListAll({
    doctype: "Page"
  });

  // Filter doctypes and sort
  const doctypeResults = useMemo(() => ({
    docs: allDoctypes
      .filter((doc) => doc.is_child_doctype === 0)
      .sort((a, b) => (a.label || a.name || "").localeCompare(b.label || b.name || ""))
  }), [allDoctypes]);

  // Sort pages
  const pageResults = useMemo(() => ({
    docs: allPages
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }), [allPages]);

  // Function to calculate relevance score for sorting
  const calculateRelevance = (
    option: SelectOption,
    searchTerm: string
  ): number => {
    if (!searchTerm) return 0;

    const searchLower = searchTerm.toLowerCase();
    const labelLower = option.label.toLowerCase();
    const valueLower = option.value.toLowerCase();
    const subtitleLower = option.subtitle?.toLowerCase() || "";

    // Exact match gets highest score
    if (labelLower === searchLower || valueLower === searchLower) {
      return 1000;
    }

    // Starts with gets high score
    if (
      labelLower.startsWith(searchLower) ||
      valueLower.startsWith(searchLower)
    ) {
      return 500;
    }

    // Contains in label gets medium score
    if (labelLower.includes(searchLower)) {
      return 100;
    }

    // Contains in value gets lower score
    if (valueLower.includes(searchLower)) {
      return 50;
    }

    // Contains in subtitle gets lowest score
    if (subtitleLower.includes(searchLower)) {
      return 25;
    }

    return 0;
  };

  // Combine and format results with translation support, sorted by relevance
  const options = useMemo(() => {
    const combinedOptions: SelectOption[] = [];

    // Add doctype results
    doctypeResults.docs.forEach((doc) => {
      const translatedLabel = t(doc.label || doc.name);
      combinedOptions.push({
        label: translatedLabel,
        value: `/desk/doctypes/${doc.name}/list`,
        icon: "BookIcon",
      });
    });

    // Add page results
    pageResults.docs.forEach((doc) => {
      const translatedName = t(doc.name);
      combinedOptions.push({
        label: translatedName,
        value: doc.href,
        icon: "FileIcon",
      });
    });

    // Sort by relevance if searchTerm exists, otherwise keep original order
    if (searchTerm) {
      combinedOptions.sort((a, b) => {
        const scoreA = calculateRelevance(a, searchTerm);
        const scoreB = calculateRelevance(b, searchTerm);

        // Higher score first (descending)
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }

        // If scores are equal, maintain alphabetical order
        return a.label.localeCompare(b.label);
      });
    }

    return combinedOptions;
  }, [doctypeResults.docs, pageResults.docs, t, searchTerm]);

  const handleLogout = async () => {
    const con = await confirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      variant: "destructive",
    });
    if (!con) return;
    await logout();
    router.push("/login");
  };

  const handleAboutZodula = async () => {
    await popup(AboutZodulaDialog, {
      title: "Zodula Framework",
      description:
        "Modern, flexible framework for building web applications with a focus on developer experience and scalability.",
      showCloseButton: true,
    });
  };

  const { organization: orgDoc, loading: orgLoading } = useOrganization();

  return (
    <>
      {/* blur background for nav */}
      <div className="zd:sticky zd:top-0 zd:z-10 zd:flex zd:w-full zd:items-center zd:justify-center no-print zd:backdrop-blur zd:bg-background/80">
        <div
          className={cn(
            "zd:flex zd:gap-4 zd:items-center zd:justify-between zd:px-4 zd:py-2 zd:w-full zd:max-w-8xl zd:transition-all zd:duration-200 zd:ease-out",
            fullWidth ? "zd:max-w-screen" : ""
          )}
        >
          <div className="zd:relative zd:group zd:flex zd:items-center zd:gap-2 zd:flex-1">
            <Link
              to={`/desk`}
              className={cn(
                "zd:text-xl zd:font-bold zd:flex zd:items-center zd:gap-2  zd:w-10 zd:h-10"
              )}
            >
              {orgLoading ? <></> : <img
                src={
                  !!orgDoc?.logo
                    ? `${orgDoc?.logo}?w=40&h=40`
                    : "/public/zodula/zodula-logo.png"
                }
                alt="Logo"
                className={cn("zd:rounded")}
              />}
            </Link>
            <Breadcrumb showHome={true} className="zd:w-full zd:ml-2 zd:max-md:hidden" />
          </div>

          <div className="zd:flex zd:gap-2 zd:items-center zd:justify-end zd:flex-1">
            <Select
              className="zd:w-full zd:max-w-md"
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              searchable
              validate
              allowFreeText
              options={options}
              displayMode="label"
              onSelect={(option) => {
                setSearchTerm("");
                router.push(option.value);
              }}
            />
            <LanguageSelection />

            {!isAuthenticated ? (
              <Link to="/login">
                <Button>Login</Button>
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="zd:flex zd:items-center zd:gap-2"
                    data-onboarding-id="user-menu"
                  >
                    <UserIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="zd:text-sm zd:flex zd:flex-col zd:min-w-48">
                    <span>{user?.name || user?.email}</span>
                    <span className="zd:text-xs zd:text-muted-foreground zd:truncate zd:max-w-40">
                      {" "}
                      {user?.id}{" "}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    href={`/desk/doctypes/Organization`}
                    data-onboarding-id="org-settings-menu"
                  >
                    {t("Organization Setting")}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={zodula.theme.toggleTheme}>
                    {t("Toggle Theme")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleFullWidth}>
                    {t("Toggle Full Width")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAboutZodula}>
                    {t("About")}
                  </DropdownMenuItem>
                  <DropdownMenuItem href="/">
                    {t("Go To Website")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="zd:text-red-600 zd:focus:text-red-600"
                  >
                    {t("Logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
