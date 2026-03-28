/**
 * Shared layout state stores.
 * Kept in a separate file to avoid circular imports between
 * desk-navbar-layout.tsx (which renders DeskNavbar) and desk-navbar.tsx
 * (which needs to read panel/sidebar state).
 */
import { create } from "zustand";

// ─── Right-sidebar (panel) open/close — desktop vs mobile, keyed by pathname ─

interface SidebarStore {
  sidebarDesktopByPath: Record<string, boolean>;
  sidebarMobileByPath: Record<string, boolean>;
  setSidebarOpen: (
    pathname: string,
    variant: "desktop" | "mobile",
    open: boolean
  ) => void;
}

export const useSidebarStoreBase = create<SidebarStore>()((set) => ({
  sidebarDesktopByPath: {},
  sidebarMobileByPath: {},
  setSidebarOpen: (pathname, variant, open) =>
    set((state) =>
      variant === "desktop"
        ? {
            sidebarDesktopByPath: {
              ...state.sidebarDesktopByPath,
              [pathname]: open,
            },
          }
        : {
            sidebarMobileByPath: {
              ...state.sidebarMobileByPath,
              [pathname]: open,
            },
          }
    ),
}));

export type SidebarStoreDefaults = {
  /** Right panel on tablet/desktop; default true */
  defaultDesktopOpen?: boolean;
  /** Right drawer on phone; default false */
  defaultMobileOpen?: boolean;
};

export function useSidebarStore(
  pathname: string,
  defaults: SidebarStoreDefaults = {}
) {
  const defaultDesktop = defaults.defaultDesktopOpen ?? true;
  const defaultMobile = defaults.defaultMobileOpen ?? false;

  const { sidebarDesktopByPath, sidebarMobileByPath, setSidebarOpen } =
    useSidebarStoreBase();

  const desktopOpen =
    sidebarDesktopByPath[pathname] ?? defaultDesktop;
  const mobileOpen = sidebarMobileByPath[pathname] ?? defaultMobile;

  return {
    desktopOpen,
    mobileOpen,
    setDesktopOpen: (open: boolean) =>
      setSidebarOpen(pathname, "desktop", open),
    setMobileOpen: (open: boolean) =>
      setSidebarOpen(pathname, "mobile", open),
    toggleDesktop: () =>
      setSidebarOpen(pathname, "desktop", !desktopOpen),
    toggleMobile: () =>
      setSidebarOpen(pathname, "mobile", !mobileOpen),
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
export function usePagePanel(
  pathname: string,
  defaults?: SidebarStoreDefaults
) {
  const { panelByPath } = usePagePanelStore();
  const { desktopOpen, mobileOpen, toggleDesktop, toggleMobile } =
    useSidebarStore(pathname, defaults);
  return {
    hasPanel: panelByPath[pathname] ?? false,
    panelOpenDesktop: desktopOpen,
    panelOpenMobile: mobileOpen,
    togglePanelDesktop: toggleDesktop,
    togglePanelMobile: toggleMobile,
  };
}
