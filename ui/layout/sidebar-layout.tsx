import React from "react";
import { Button } from "../components/ui/button";
import { Menu, X, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { cn } from "../lib/utils";
import { create } from "zustand";
import { useRouter } from "../components/router";

export interface ActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}

export interface PrimaryAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "solid" | "subtle" | "outline" | "ghost" | "success";
}

export interface SidebarLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  sidebarContent?: React.ReactNode;
  actionSection?: React.ReactNode;
  primaryAction?: PrimaryAction | PrimaryAction[];
  actions?: ActionItem[];
  defaultOpen?: boolean;
}

export interface SidebarMenuProps {
  items: SidebarMenuItem[];
  activeId: string;
  topMenu: React.ReactNode;
  bottomMenu: React.ReactNode;
}

interface SidebarMenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  onClick: () => void;
  idx: number;
}

interface SidebarStore {
  sidebarOpenByPath: Record<string, boolean>;
  setSidebarOpen: (pathname: string, open: boolean) => void;
  toggleSidebar: (pathname: string) => void;
}

const useSidebarStoreBase = create<SidebarStore>()((set) => ({
  sidebarOpenByPath: {},
  setSidebarOpen: (pathname, open) =>
    set((state) => ({
      sidebarOpenByPath: {
        ...state.sidebarOpenByPath,
        [pathname]: open,
      },
    })),
  toggleSidebar: (pathname) =>
    set((state) => ({
      sidebarOpenByPath: {
        ...state.sidebarOpenByPath,
        [pathname]: !(state.sidebarOpenByPath[pathname] ?? false),
      },
    })),
}));

export function useSidebarStore(pathname: string, defaultOpen = false) {
  const { sidebarOpenByPath, setSidebarOpen, toggleSidebar } = useSidebarStoreBase();
  const sidebarOpen = sidebarOpenByPath[pathname] ?? defaultOpen;
  return {
    sidebarOpen,
    setSidebarOpen: (open: boolean) => setSidebarOpen(pathname, open),
    toggleSidebar: () => toggleSidebar(pathname),
  };
}

export const SidebarLayout = ({
  children,
  title,
  subtitle,
  sidebarContent,
  actionSection,
  primaryAction,
  actions = [],
  defaultOpen = false,
}: SidebarLayoutProps) => {
  const { pathname } = useRouter();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useSidebarStore(pathname, defaultOpen);

  const renderActions = () => {
    const primaryActions = Array.isArray(primaryAction)
      ? primaryAction
      : primaryAction
        ? [primaryAction]
        : [];

    return (
      <div
        id="action-section"
        className="zd:flex zd:items-center zd:gap-2 no-print zd:justify-end zd:flex-1"
      >
        {actionSection && (
          <div className="no-print zd:flex zd:items-center zd:gap-2">
            {actionSection}
          </div>
        )}
        {primaryActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "solid"}
            onClick={action.onClick}
            disabled={action.disabled}
            className="no-print"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle">
                <MoreHorizontal className="zd:h-4 zd:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, index) => (
                <React.Fragment key={action.id}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={
                      action.variant === "destructive"
                        ? "zd:text-destructive"
                        : ""
                    }
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="zd:flex zd:flex-col zd:h-full zd:gap-4 zd:w-full zd:flex-grow">
      <div className="zd:flex zd:items-center zd:justify-between zd:flex-wrap zd:gap-2">
        <div className="zd:flex zd:items-center zd:gap-4">
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            className="zd:p-0! zd:h-8 zd:w-8 no-print"
          >
            <Menu className="zd:w-6! zd:h-6!" />
          </Button>
          <div className="zd:flex zd:flex-col">
            <h1 className="zd:text-xl zd:font-semibold zd:text-foreground zd:truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="zd:text-sm zd:text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {renderActions()}
      </div>
      <div
        className={cn(
          "zd:flex zd:bg-background zd:flex-grow",
          sidebarOpen ? "zd:gap-4" : "zd:gap-0"
        )}
      >
        {/* Sidebar */}
        <div
          className={`zd:flex zd:flex-col zd:transition-all zd:duration-300 ${sidebarOpen ? "zd:min-w-80" : "zd:min-w-0 zd:w-0 zd:overflow-hidden"
            }`}
        >
          {sidebarOpen && (
            <div className="zd:flex zd:flex-col zd:h-full">
              {/* Sidebar Content */}
              <div className="zd:flex-1 zd:overflow-y-auto">
                {sidebarContent}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-4 zd:w-full zd:flex-grow">
          {/* Main Content Area */}
          <div className="zd:flex-1 zd:flex-grow">{children}</div>
        </div>
      </div>
    </div>
  );
};
