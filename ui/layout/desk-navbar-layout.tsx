import React from "react";
import { DeskNavbar } from "../components/custom/desk-navbar";
import { LeftNavSidebar } from "../components/custom/left-nav-sidebar";
import { useRouter } from "../components/router";
import { useNavbar } from "../hooks/use-navbar";
import { useIsTabletOrUp } from "../hooks/use-media-query";
import { Button } from "../components/ui/button";
import { Drawer } from "../components/ui/drawer";
import { MoreHorizontal, ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { cn } from "../lib/utils";
import { useSidebarStore } from "../hooks/use-layout-state";

// ─── Re-export store hook so existing callers don't need to update imports ────
export { useSidebarStore } from "../hooks/use-layout-state";

// ─── Exported types ────────────────────────────────────────────────────────────

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

export interface SecondaryAction {
  label: string;
  icon?: React.ComponentType<any>;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "outline" | "ghost" | "solid" | "subtle" | "success";
  items?: Array<{
    label: string;
    icon?: React.ComponentType<any>;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
  }>;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface DeskNavbarLayoutProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  hideNavbar?: boolean;
  // Page header & right-sidebar props
  title?: React.ReactNode;
  subtitle?: string;
  rightSidebar?: React.ReactNode;
  actionSection?: React.ReactNode;
  primaryAction?: PrimaryAction | PrimaryAction[];
  secondaryActions?: SecondaryAction[];
  actions?: ActionItem[];
  defaultOpen?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const DeskNavbarLayout = ({
  children,
  className,
  contentClassName,
  hideNavbar,
  title,
  subtitle,
  rightSidebar,
  actionSection,
  primaryAction,
  secondaryActions = [],
  actions = [],
  defaultOpen = true,
}: DeskNavbarLayoutProps) => {
  const { fullWidth } = useNavbar();
  const router = useRouter();
  const isDesk = router.pathname.startsWith("/desk");
  const isTabletOrUp = useIsTabletOrUp();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useSidebarStore(
    router.pathname,
    defaultOpen
  );

  // Whether to render the page-header bar
  const hasPageHeader = !!(
    title ||
    rightSidebar ||
    actionSection ||
    primaryAction ||
    secondaryActions?.length ||
    actions?.length
  );

  // ── Action bar renderer ────────────────────────────────────────────────────
  const renderActions = () => {
    const primaryActions = Array.isArray(primaryAction)
      ? primaryAction
      : primaryAction
        ? [primaryAction]
        : [];

    return (
      <div id="action-section" className="zd:flex zd:items-center zd:gap-2 no-print">
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
        {secondaryActions.map((button, index) => {
          if (button.items && button.items.length > 0) {
            const Icon = button.icon;
            return (
              <DropdownMenu key={`secondary-${index}`}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={button.variant || "outline"}
                    className="no-print"
                    disabled={button.disabled}
                  >
                    {Icon && <Icon className="zd:w-4 zd:h-4" />}
                    {button.label}
                    <ChevronDown className="zd:w-3.5 zd:h-3.5 zd:opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {button.items.map((item, itemIndex) => {
                    const ItemIcon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={itemIndex}
                        onClick={item.onClick}
                        disabled={item.disabled}
                      >
                        {ItemIcon && <ItemIcon className="zd:w-4 zd:h-4" />}
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          const Icon = button.icon;
          return (
            <Button
              key={`secondary-${index}`}
              variant={button.variant || "outline"}
              onClick={button.onClick}
              disabled={button.disabled}
              className="no-print"
            >
              {Icon && <Icon className="zd:w-4 zd:h-4" />}
              {button.label}
            </Button>
          );
        })}
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

  // ── Non-desk / hideNavbar — plain layout ──────────────────────────────────
  if (!isDesk || hideNavbar) {
    return (
      <div className={cn("zd:flex zd:flex-col zd:w-full zd:min-h-screen", className)}>
        <div className={cn("zd:flex zd:flex-col zd:flex-grow", contentClassName)}>
          {children}
        </div>
      </div>
    );
  }

  // ── Desk app shell ─────────────────────────────────────────────────────────
  return (
    <div className={cn("zd:flex zd:h-screen zd:w-full zd:overflow-hidden", className)}>
      {/* Left navigation sidebar */}
      <LeftNavSidebar />

      {/* Right panel: sticky navbar + content area */}
      <div className="zd:flex zd:flex-col zd:flex-1 zd:min-w-0 zd:overflow-hidden">
        {/* Sticky top bar — panel toggle injected directly to avoid store timing gaps */}
        <DeskNavbar
          panelToggle={
            rightSidebar ? (
              <Button
                variant="ghost"
                onClick={toggleSidebar}
                className="zd:h-8 zd:w-8 zd:p-0! zd:shrink-0 no-print"
                title={sidebarOpen ? "Close panel" : "Open panel"}
              >
                {sidebarOpen
                  ? <PanelRightClose className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                  : <PanelRightOpen className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                }
              </Button>
            ) : undefined
          }
        />

        {/* Content row: [left col: header + main] | [right sidebar panel] */}
        <div className="zd:flex zd:flex-1 zd:min-h-0 zd:overflow-hidden">

          {/* Left column */}
          <div className="zd:flex zd:flex-col zd:flex-1 zd:min-w-0 zd:h-full zd:overflow-auto zd:p-4">

            {/* Page header bar (title + actions) */}
            {hasPageHeader && (
              <div className="zd:flex zd:items-center zd:justify-between zd:flex-wrap zd:gap-2 zd:min-h-10 zd:shrink-0">
                <div className="zd:flex zd:flex-col zd:gap-0.5">
                  <h1 className="zd:text-2xl zd:font-bold zd:text-foreground zd:leading-tight zd:truncate">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="zd:text-xs zd:text-muted-foreground zd:leading-tight">
                      {subtitle}
                    </p>
                  )}
                </div>
                <div className="zd:flex zd:items-center zd:gap-2 zd:flex-1 zd:justify-end no-print">
                  {renderActions()}
                </div>
              </div>
            )}

            {/* Main content */}
            <main className={cn("zd:flex-1 zd:min-h-0 zd:mt-1", contentClassName)}>
              {hasPageHeader ? (
                children
              ) : (
                <div
                  className={cn(
                    "zd:flex zd:flex-col zd:gap-4 zd:w-full zd:min-h-full",
                    !fullWidth ? "zd:max-w-screen-2xl" : ""
                  )}
                >
                  {children}
                </div>
              )}
            </main>

            {/* Mobile drawer (< tablet) */}
            {!isTabletOrUp && rightSidebar && (
              <Drawer
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                side="right"
                width="min(300px, 85vw)"
              >
                {rightSidebar}
              </Drawer>
            )}
          </div>

          {/* Right sidebar panel — full height alongside left column */}
          {isTabletOrUp && rightSidebar && (
            <div
              className={cn(
                "zd:flex zd:flex-col zd:shrink-0 zd:transition-all zd:duration-300 zd:ease-in-out zd:overflow-hidden",
                sidebarOpen
                  ? "zd:w-72 zd:min-w-72 zd:opacity-100"
                  : "zd:w-0 zd:min-w-0 zd:opacity-0"
              )}
            >
              {sidebarOpen && (
                <div className="zd:flex zd:flex-col zd:h-full zd:border-l zd:border-border zd:bg-card zd:overflow-y-auto zd:shadow-sm zd:p-3">
                  {rightSidebar}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
