/**
 * Shared layout state stores.
 * Kept in a separate file to avoid circular imports between
 * desk-navbar-layout.tsx (which renders DeskNavbar) and desk-navbar.tsx
 * (which needs to read panel/sidebar state).
 */
import { create } from "zustand";

// ─── Right-sidebar (panel) open/close — keyed by pathname ────────────────────

interface SidebarStore {
  sidebarOpenByPath: Record<string, boolean>;
  setSidebarOpen: (pathname: string, open: boolean) => void;
  toggleSidebar: (pathname: string) => void;
}

export const useSidebarStoreBase = create<SidebarStore>()((set) => ({
  sidebarOpenByPath: {},
  setSidebarOpen: (pathname, open) =>
    set((state) => ({
      sidebarOpenByPath: { ...state.sidebarOpenByPath, [pathname]: open },
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
  const { sidebarOpenByPath, setSidebarOpen, toggleSidebar } =
    useSidebarStoreBase();
  const sidebarOpen = sidebarOpenByPath[pathname] ?? defaultOpen;
  return {
    sidebarOpen,
    setSidebarOpen: (open: boolean) => setSidebarOpen(pathname, open),
    toggleSidebar: () => toggleSidebar(pathname),
  };
}

// ─── Panel presence — DeskNavbarLayout registers, DeskNavbar reads ───────────

interface PagePanelStore {
  /** pathname → whether that page has a rightSidebar */
  panelByPath: Record<string, boolean>;
  registerPanel: (pathname: string, has: boolean) => void;
}

export const usePagePanelStore = create<PagePanelStore>()((set) => ({
  panelByPath: {},
  registerPanel: (pathname, has) =>
    set((state) => ({
      panelByPath: { ...state.panelByPath, [pathname]: has },
    })),
}));

/** Used by DeskNavbar to render the panel toggle button. */
export function usePagePanel(pathname: string) {
  const { panelByPath } = usePagePanelStore();
  const { sidebarOpen, toggleSidebar } = useSidebarStore(pathname);
  return {
    hasPanel: panelByPath[pathname] ?? false,
    panelOpen: sidebarOpen,
    togglePanel: toggleSidebar,
  };
}
