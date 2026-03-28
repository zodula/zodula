import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NavbarStore {
    fullWidth: boolean;
    setFullWidth: (fullWidth: boolean) => void;
    toggleFullWidth: () => void;
    leftSidebarOpenDesktop: boolean;
    leftSidebarOpenMobile: boolean;
    setLeftSidebarOpenDesktop: (open: boolean) => void;
    setLeftSidebarOpenMobile: (open: boolean) => void;
    toggleLeftSidebarDesktop: () => void;
    toggleLeftSidebarMobile: () => void;
}

export const useNavbar = create<NavbarStore>()(
    persist(
        (set) => ({
            fullWidth: false,
            setFullWidth: (fullWidth: boolean) => set({ fullWidth }),
            toggleFullWidth: () => set((state) => ({ fullWidth: !state.fullWidth })),
            leftSidebarOpenDesktop: true,
            leftSidebarOpenMobile: false,
            setLeftSidebarOpenDesktop: (open: boolean) => set({ leftSidebarOpenDesktop: open }),
            setLeftSidebarOpenMobile: (open: boolean) => set({ leftSidebarOpenMobile: open }),
            toggleLeftSidebarDesktop: () => set((state) => ({ leftSidebarOpenDesktop: !state.leftSidebarOpenDesktop })),
            toggleLeftSidebarMobile: () => set((state) => ({ leftSidebarOpenMobile: !state.leftSidebarOpenMobile })),
        }),
        {
            name: "zodula-navbar-storage",
        }
    )
)
