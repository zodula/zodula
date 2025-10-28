import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NavbarStore {
    fullWidth: boolean;
    setFullWidth: (fullWidth: boolean) => void;
    toggleFullWidth: () => void;
}

export const useNavbar = create<NavbarStore>()(
    persist(
        (set) => ({
            fullWidth: false,
            setFullWidth: (fullWidth: boolean) => set({ fullWidth }),
            toggleFullWidth: () => set((state) => ({ fullWidth: !state.fullWidth })),
        }),
        {
            name: "zodula-navbar-storage", // unique name for localStorage key
        }
    )
)