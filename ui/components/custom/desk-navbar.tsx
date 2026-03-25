import { Link } from "react-router";
import { Select, type SelectOption } from "../ui/select";
import { useState, useMemo, useEffect, useRef } from "react";
import { zodula } from "@/zodula/client";
import { useRouter } from "../router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { UserIcon, BookIcon, FileIcon, PanelLeftOpen, Search, X } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useDocListAll } from "../../hooks/use-doc-list-all";
import { useTranslation } from "../../hooks/use-translation";
import { AboutZodulaDialog } from "../dialogs/about-zodula-dialog";
import { confirm, popup } from "../ui/popit";
import { useNavbar } from "../../hooks/use-navbar";
import { cn } from "../../lib/utils";
import { LanguageSelection } from "./language-selection";
import { Breadcrumb } from "./breadcrumb";

export interface DeskNavbarProps {
  children?: React.ReactNode;
  /** Panel toggle button rendered on the right side next to user button, injected by DeskNavbarLayout */
  panelToggle?: React.ReactNode;
}

export const DeskNavbar = ({ children, panelToggle }: DeskNavbarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { fullWidth, toggleFullWidth, leftSidebarOpen, toggleLeftSidebar } = useNavbar();
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

    if (labelLower === searchLower || valueLower === searchLower) return 1000;
    if (labelLower.startsWith(searchLower) || valueLower.startsWith(searchLower)) return 500;
    if (labelLower.includes(searchLower)) return 100;
    if (valueLower.includes(searchLower)) return 50;
    if (subtitleLower.includes(searchLower)) return 25;
    return 0;
  };

  // Combine and format results with translation support, sorted by relevance
  const options = useMemo(() => {
    const combinedOptions: SelectOption[] = [];

    doctypeResults.docs.forEach((doc) => {
      combinedOptions.push({
        label: t(doc.label || doc.name),
        value: `/desk/doctypes/${doc.name}/list`,
        icon: "BookIcon",
      });
    });

    pageResults.docs.forEach((doc) => {
      combinedOptions.push({
        label: t(doc.name),
        value: doc.href,
        icon: "FileIcon",
      });
    });

    if (searchTerm) {
      combinedOptions.sort((a, b) => {
        const scoreA = calculateRelevance(a, searchTerm);
        const scoreB = calculateRelevance(b, searchTerm);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.label.localeCompare(b.label);
      });
    }

    return combinedOptions;
  }, [doctypeResults.docs, pageResults.docs, t, searchTerm]);

  // Close overlay on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

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

  const searchOverlayRef = useRef<HTMLDivElement>(null);

  // Auto-focus the search input when overlay opens
  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => {
      const input = searchOverlayRef.current?.querySelector("input");
      if (input) input.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
  };

  return (
    <>
      {/* Slim top bar */}
      <header className="zd:h-12 zd:flex zd:w-full zd:items-center zd:justify-between zd:px-3 zd:py-2 zd:border-b zd:border-border zd:bg-background zd:shrink-0 no-print">
        {/* Left: sidebar toggle (when collapsed) + breadcrumb */}
        <div className="zd:flex zd:items-center zd:gap-2 zd:flex-1 zd:min-w-0">
          {!leftSidebarOpen && (
            <Button
              variant="ghost"
              onClick={toggleLeftSidebar}
              className="zd:h-8 zd:w-8 zd:p-0! zd:shrink-0"
              title="Open sidebar"
            >
              <PanelLeftOpen className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
            </Button>
          )}
          <Breadcrumb showHome={false} className="zd:min-w-0" />
        </div>

        {/* Right: search + language + panel toggle + user */}
        <div className="zd:flex zd:items-center zd:gap-1 zd:shrink-0">
          {/* Search button */}
          <Button
            variant="ghost"
            onClick={() => setSearchOpen(true)}
            className="zd:h-8 zd:w-8 zd:p-0! zd:shrink-0"
            title="Search"
          >
            <Search className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
          </Button>

          {/* Language */}
          <LanguageSelection />

          {/* User */}
          {!isAuthenticated ? (
            <Link to="/login">
              <Button size="sm">Login</Button>
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="zd:h-8 zd:w-8 zd:p-0! zd:rounded-full zd:shrink-0"
                >
                  <div className="zd:w-7 zd:h-7 zd:rounded-full zd:bg-primary/10 zd:flex zd:items-center zd:justify-center">
                    <UserIcon className="zd:w-3.5 zd:h-3.5 zd:text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="zd:min-w-52">
                <div className="zd:px-2.5 zd:py-2 zd:border-b zd:border-border zd:mb-1">
                  <p className="zd:text-sm zd:font-medium zd:text-foreground zd:truncate">
                    {user?.name || user?.email}
                  </p>
                  <p className="zd:text-xs zd:text-muted-foreground zd:truncate zd:max-w-44">
                    {user?.id}
                  </p>
                </div>
                <DropdownMenuItem
                  href={`/desk/doctypes/Global Setting`}
                >
                  {t("Global Setting")}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="zd:text-destructive zd:focus:text-destructive zd:hover:bg-destructive/10"
                >
                  {t("Logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Panel toggle (right sidebar open/close) */}
          {panelToggle}
        </div>
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <div
          className="zd:fixed zd:inset-0 zd:z-50 zd:flex zd:flex-col zd:items-center zd:pt-20 zd:backdrop-blur-xs zd:bg-background/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSearch();
          }}
        >
          {/* Close button */}
          <button
            className="zd:absolute zd:top-4 zd:right-4 zd:p-2 zd:rounded-full zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-accent zd:transition-colors"
            onClick={closeSearch}
            title="Close search"
          >
            <X className="zd:w-5 zd:h-5" />
          </button>

          {/* Search input box */}
          <div ref={searchOverlayRef} className="zd:w-full zd:max-w-xl zd:px-4">
            <Select
              className="zd:w-full"
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              searchable
              validate
              allowFreeText
              options={options}
              displayMode="label"
              placeholder={t("Search doctypes and pages...")}
              onSelect={(option) => {
                closeSearch();
                router.push(option.value);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
