import { Link } from "react-router";
import { useRouter } from "../router";
import { useNavbar } from "../../hooks/use-navbar";
import { useDocAll } from "../../hooks/use-doc-all";
import { useTranslation } from "../../hooks/use-translation";
import { useWorkspace } from "../workspace/use-workspace";
import { useAuth } from "../../hooks/use-auth";
import { cn } from "../../lib/utils";
import { DynamicIcon, type IconName } from "../ui/dynamic-icon";
import {
  PanelLeftClose,
  ChevronRight,
  ChevronsUpDown,
  Settings2,
  GitBranch,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useState, useEffect, useMemo } from "react";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { useIsTabletOrUp } from "../../hooks/use-media-query";
import { popup } from "../ui/popit";
import { WorkspaceEditPopup } from "../workspace/workspace-edit-popup";

// ─── Nearest-match helper ─────────────────────────────────────────────────────

/**
 * Find the workspace whose URL is the best match for `decodedPath`.
 * Returns `{ id, isExact }` or `null` if no match with ≥2 segments.
 */
function findNearestWorkspace(
  workspaces: any[],
  decodedPath: string
): { id: string; isExact: boolean } | null {
  // Exact match first
  const exact = workspaces.find((w) => w.url && w.url === decodedPath);
  if (exact) return { id: exact.id, isExact: true };

  // Prefix match — all URL segments except the last must match.
  // e.g. "/desk/doctypes/Sales Invoice/list" (4 segs) requires score ≥ 3,
  // so "/desk/doctypes/Payment Entry/list" (score=2) is rejected while
  // "/desk/doctypes/Sales Invoice/form/SINV-001" (score=3) is accepted.
  const pathParts = decodedPath.split("/").filter(Boolean);
  let best: any = null;
  let bestScore = 0;

  for (const w of workspaces) {
    if (!w.url) continue;
    const urlParts = w.url.split("/").filter(Boolean);
    if (urlParts.length < 2) continue;

    let score = 0;
    for (let i = 0; i < Math.min(pathParts.length, urlParts.length); i++) {
      if (pathParts[i] === urlParts[i]) score++;
      else break;
    }

    const required = urlParts.length - 1;
    if (score >= required && score > bestScore) {
      bestScore = score;
      best = w;
    }
  }

  return best ? { id: best.id, isExact: false } : null;
}

// ─── Workspace nav tree ──────────────────────────────────────────────────────

const WORKSPACE_EXPANDED_KEY = "zodula-sidebar-expanded";

interface WorkspaceNavTreeProps {
  workspaces: any[];
  parentId: string;
  level: number;
  currentPath: string;
  /** ID of the active workspace (exact or nearest-match) */
  activeId: string | null;
  /** Whether `activeId` is an exact URL match */
  activeIsExact: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

const WorkspaceNavTree = ({
  workspaces,
  parentId,
  level,
  currentPath,
  activeId,
  activeIsExact,
  expanded,
  onToggle,
}: WorkspaceNavTreeProps) => {
  const { t } = useTranslation();

  const children = useMemo(
    () =>
      workspaces
        .filter((w) => w.workspace_parent === parentId)
        .sort((a, b) => (a.idx || 0) - (b.idx || 0)),
    [workspaces, parentId]
  );

  if (children.length === 0) return null;

  return (
    <div className="zd:flex zd:flex-col zd:pt-1 zd:gap-1">
      {children.map((workspace) => {
        const hasChildren = workspaces.some(
          (w) => w.workspace_parent === workspace.id
        );

        const isActive = workspace.id === activeId && activeIsExact;
        const isNearestMatch = workspace.id === activeId && !activeIsExact;
        const isExpanded = expanded.has(workspace.id);
        const indent = level * 12;

        const itemClass = cn(
          "zd:flex zd:items-center zd:gap-2 zd:px-2 zd:py-1.5 zd:rounded-lg zd:text-sm",
          "zd:transition-colors zd:duration-100 zd:w-full zd:text-left zd:group",
          isActive
            ? "zd:bg-primary/10 zd:text-primary zd:font-medium"
            : isNearestMatch
              ? "zd:bg-primary/5 zd:text-primary/60 zd:font-medium"
              : "zd:text-muted-foreground zd:hover:bg-accent zd:hover:text-accent-foreground"
        );

        const iconEl = (
          <span className="zd:shrink-0 zd:w-4 zd:h-4 zd:flex zd:items-center zd:justify-center">
            <DynamicIcon
              iconName={(workspace.icon || "Folder") as IconName}
              className="zd:w-3.5 zd:h-3.5"
            />
          </span>
        );

        return (
          <div key={workspace.id}>
            {/* Item row */}
            {workspace.url ? (
              <Link
                to={workspace.url}
                className={itemClass}
                style={{ paddingLeft: `${8 + indent}px` }}
              >
                {iconEl}
                <span className="zd:flex-1 zd:truncate">{t(workspace.name)}</span>
              </Link>
            ) : (
              <button
                className={itemClass}
                style={{ paddingLeft: `${8 + indent}px` }}
                onClick={() => hasChildren && onToggle(workspace.id)}
              >
                {iconEl}
                <span className="zd:flex-1 zd:truncate zd:text-left">
                  {t(workspace.name)}
                </span>
                {hasChildren && (
                  <ChevronRight
                    className={cn(
                      "zd:w-3 zd:h-3 zd:shrink-0 zd:transition-transform zd:duration-150",
                      isExpanded && "zd:rotate-90"
                    )}
                  />
                )}
              </button>
            )}

            {/* Children */}
            {hasChildren && isExpanded && (
              <WorkspaceNavTree
                workspaces={workspaces}
                parentId={workspace.id}
                level={level + 1}
                currentPath={currentPath}
                activeId={activeId}
                activeIsExact={activeIsExact}
                expanded={expanded}
                onToggle={onToggle}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main sidebar ────────────────────────────────────────────────────────────

export const LeftNavSidebar = ({ mobileDrawer = false }: { mobileDrawer?: boolean }) => {
  const {
    leftSidebarOpenDesktop,
    leftSidebarOpenMobile,
    toggleLeftSidebarDesktop,
    toggleLeftSidebarMobile,
  } = useNavbar();
  const isTabletOrUp = useIsTabletOrUp();
  const leftSidebarOpen = isTabletOrUp ? leftSidebarOpenDesktop : leftSidebarOpenMobile;
  const toggleLeftSidebar = isTabletOrUp ? toggleLeftSidebarDesktop : toggleLeftSidebarMobile;
  const { pathname } = useRouter();
  const { doc: globalSetting, loading: globalLoading } = useDocAll({
    doctype: "Global Setting",
    id: "Global Setting",
  });
  const { doc: orgDoc, loading: orgLoading } = useDocAll({
    doctype: "Organization",
    id: "Organization",
  });
  const { t } = useTranslation();
  const { workspaces } = useWorkspace();
  const { roles } = useAuth()
  const isSystemAdmin = roles.includes("System Admin")

  const openRootWorkspaceEdit = async () => {
    await popup(
      WorkspaceEditPopup,
      {
        title: "Edit Root Workspaces",
        description: "Manage root workspace names, icons, and order.",
        width: "840px",
        maxWidth: "94vw",
      },
      {
        workspaces,
        selectedRootId,
        mode: "root",
      }
    )
  }

  const openChildWorkspaceEdit = async () => {
    await popup(
      WorkspaceEditPopup,
      {
        title: "Edit Child Workspaces",
        description: "Manage child workspace names, URLs, icons, and order at every level under each root.",
        width: "960px",
        maxWidth: "96vw",
      },
      {
        workspaces,
        selectedRootId,
        mode: "child",
      }
    )
  }

  // Root workspaces (no parent)
  const rootWorkspaces = useMemo(
    () =>
      workspaces
        .filter((w) => !w.workspace_parent)
        .sort((a, b) => (a.idx || 0) - (b.idx || 0)),
    [workspaces]
  );

  // Nearest matching workspace for current path
  const nearestMatch = useMemo(() => {
    const decodedPath = decodeURIComponent(pathname);
    return findNearestWorkspace(workspaces, decodedPath);
  }, [workspaces, pathname]);

  // Selected root workspace — persisted in localStorage
  const [selectedRootId, setSelectedRootId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("zodula-root-workspace") || null;
    } catch {
      return null;
    }
  });

  // Auto-select first root workspace when list loads and nothing is selected
  useEffect(() => {
    if (rootWorkspaces.length > 0 && !selectedRootId) {
      setSelectedRootId(rootWorkspaces[0]!.id);
    }
    // If selected root no longer exists, fall back to first
    if (
      selectedRootId &&
      rootWorkspaces.length > 0 &&
      !rootWorkspaces.find((w) => w.id === selectedRootId)
    ) {
      setSelectedRootId(rootWorkspaces[0]!.id);
    }
  }, [rootWorkspaces, selectedRootId]);

  // Persist selected root
  useEffect(() => {
    if (selectedRootId) {
      try {
        localStorage.setItem("zodula-root-workspace", selectedRootId);
      } catch {}
    }
  }, [selectedRootId]);

  // Auto-detect root workspace from nearest match (exact or prefix)
  useEffect(() => {
    if (!nearestMatch) return;
    const matched = workspaces.find((w) => w.id === nearestMatch.id);
    if (!matched) return;
    // Walk up to find root
    let current: any = matched;
    while (current?.workspace_parent) {
      current = workspaces.find((w) => w.id === current.workspace_parent);
    }
    if (current && current.id !== selectedRootId) {
      setSelectedRootId(current.id);
    }
  }, [nearestMatch?.id, workspaces]);

  // Expanded state for workspace tree
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(WORKSPACE_EXPANDED_KEY);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(WORKSPACE_EXPANDED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // Auto-expand ancestors of the nearest-matched workspace
  useEffect(() => {
    if (!nearestMatch) return;
    const active = workspaces.find((w) => w.id === nearestMatch.id);
    if (!active) return;
    const ancestors: string[] = [];
    let cur: any = active;
    while (cur?.workspace_parent) {
      ancestors.push(cur.workspace_parent);
      cur = workspaces.find((w) => w.id === cur.workspace_parent);
    }
    if (ancestors.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        ancestors.forEach((id) => next.add(id));
        try {
          localStorage.setItem(
            WORKSPACE_EXPANDED_KEY,
            JSON.stringify([...next])
          );
        } catch {}
        return next;
      });
    }
  }, [nearestMatch?.id, workspaces]);

  const selectedRoot = rootWorkspaces.find((w) => w.id === selectedRootId);

  return (
    <>
      <aside
        className={cn(
          "zd:h-full zd:flex zd:flex-col zd:shrink-0 zd:border-r zd:border-border zd:bg-sidebar",
          "zd:transition-all zd:duration-300 zd:ease-in-out zd:overflow-hidden no-print",
          mobileDrawer
            ? "zd:w-full zd:min-w-0"
            : leftSidebarOpen
              ? "zd:w-64 zd:min-w-64"
              : "zd:w-0 zd:min-w-0"
        )}
      >
        <div className="zd:flex zd:flex-col zd:h-full zd:gap-2">
          {/* Logo + collapse button */}
          <div className="zd:flex zd:items-center zd:justify-between zd:px-3 zd:border-b zd:border-border/60 zd:shrink-0 zd:ml-1 zd:h-12">
            <Link
              to="/desk"
              className="zd:flex zd:items-center zd:gap-2.5 zd:min-w-0"
            >
              <div className="zd:w-7 zd:h-7 zd:rounded-lg zd:overflow-hidden zd:shrink-0">
                {globalLoading ? (
                  <div className="zd:w-7 zd:h-7 zd:bg-muted zd:rounded-lg zd:animate-pulse" />
                ) : (
                  <img
                    src={
                      globalSetting?.logo
                        ? `${globalSetting.logo}?w=28&h=28`
                        : "/public/zodula/zodula-logo.png"
                    }
                    alt="Logo"
                    className="zd:w-7 zd:h-7 zd:object-cover"
                  />
                )}
              </div>
              <div className="zd:flex zd:flex-col zd:min-w-0">
                <span className="zd:text-sm zd:font-semibold zd:text-foreground zd:truncate">
                  {globalLoading ? (
                    <span className="zd:block zd:h-4 zd:w-20 zd:bg-muted zd:rounded zd:animate-pulse" />
                  ) : (
                    globalSetting?.website_name || "Zodula"
                  )}
                </span>
                <span className="zd:text-xs zd:text-muted-foreground zd:truncate">
                  {orgLoading ? (
                    <span className="zd:block zd:h-3 zd:w-24 zd:bg-muted zd:rounded zd:animate-pulse" />
                  ) : (
                    orgDoc?.organization_name || ""
                  )}
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              onClick={toggleLeftSidebar}
              className="zd:h-7 zd:w-7 zd:p-0! zd:shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
            </Button>
          </div>

          {/* Root workspace selector / workspace edit */}
          <div className="zd:px-2 zd:shrink-0 zd:flex zd:items-center zd:gap-1">
            {rootWorkspaces.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="zd:w-full zd:justify-between zd:px-2 zd:h-8 zd:text-sm zd:font-medium zd:text-foreground zd:bg-accent/50 zd:hover:bg-accent"
                  >
                    <span className="zd:flex zd:items-center zd:gap-2 zd:min-w-0">
                      {selectedRoot && (
                        <DynamicIcon
                          iconName={(selectedRoot.icon || "Folder") as IconName}
                          className="zd:w-3.5 zd:h-3.5 zd:shrink-0"
                        />
                      )}
                      <span className="zd:truncate">
                        {selectedRoot ? t(selectedRoot.name) : t("Select workspace")}
                      </span>
                    </span>
                    <ChevronsUpDown className="zd:w-3.5 zd:h-3.5 zd:shrink-0 zd:text-muted-foreground zd:ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="zd:w-52 zd:space-y-1"
                >
                  {rootWorkspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => setSelectedRootId(ws.id)}
                      className={cn(
                        ws.id === selectedRootId &&
                          "zd:bg-primary/10 zd:text-primary"
                      )}
                    >
                      <DynamicIcon
                        iconName={(ws.icon || "Folder") as IconName}
                        className="zd:w-4 zd:h-4 zd:mr-2 zd:shrink-0"
                      />
                      {t(ws.name)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                className="zd:w-full zd:justify-start zd:px-2 zd:h-8 zd:text-sm zd:font-medium zd:text-muted-foreground zd:bg-accent/30 zd:hover:bg-accent"
                onClick={openRootWorkspaceEdit}
                disabled={!isSystemAdmin}
              >
                {t("Create workspace")}
              </Button>
            )}
            {isSystemAdmin && (
              <>
                <Button
                  variant="ghost"
                  className="zd:h-8 zd:w-8 zd:p-0!"
                  title="Edit root workspaces"
                  onClick={openRootWorkspaceEdit}
                >
                  <Settings2 className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  className="zd:h-8 zd:w-8 zd:p-0!"
                  title="Edit child workspaces"
                  onClick={openChildWorkspaceEdit}
                >
                  <GitBranch className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                </Button>
              </>
            )}
          </div>

          <Separator className="zd:h-[1px] zd:bg-border/50" />

          {/* Workspace nav tree — scrollable */}
          <div className="zd:flex-1 zd:overflow-y-auto zd:px-2 zd:pb-3 zd:min-h-0">
            {selectedRootId ? (
              <WorkspaceNavTree
                workspaces={workspaces}
                parentId={selectedRootId}
                level={0}
                currentPath={pathname}
                activeId={nearestMatch?.id ?? null}
                activeIsExact={nearestMatch?.isExact ?? false}
                expanded={expanded}
                onToggle={toggleExpanded}
              />
            ) : (
              <p className="zd:text-xs zd:text-muted-foreground zd:px-2 zd:py-2">
                {t("No workspace selected")}
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
