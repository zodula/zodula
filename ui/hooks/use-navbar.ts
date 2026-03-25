import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NavbarStore {
    fullWidth: boolean;
    setFullWidth: (fullWidth: boolean) => void;
    toggleFullWidth: () => void;
    leftSidebarOpen: boolean;
    setLeftSidebarOpen: (open: boolean) => void;
    toggleLeftSidebar: () => void;
}

export const useNavbar = create<NavbarStore>()(
    persist(
        (set) => ({
            fullWidth: false,
            setFullWidth: (fullWidth: boolean) => set({ fullWidth }),
            toggleFullWidth: () => set((state) => ({ fullWidth: !state.fullWidth })),
            leftSidebarOpen: true,
            setLeftSidebarOpen: (open: boolean) => set({ leftSidebarOpen: open }),
            toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
        }),
        {
            name: "zodula-navbar-storage",
        }
    )
)
