import { create } from "zustand"
import { useEffect, useMemo, useCallback } from "react"
import { zodula } from "@/zodula/client"
import { getCookie } from "../lib/utils"

export interface User {
    id: string
    email?: string | null
    name?: string | null
    [key: string]: any
}

interface AuthState {
    user: User | null
    roles: string[]
    isLoading: boolean
    error: string | null
    isInitialized: boolean
}

interface AuthActions {
    setUser: (user: User | null) => void
    setRoles: (roles: string[]) => void
    setLoading: (isLoading: boolean) => void
    setError: (error: string | null) => void
    setInitialized: (isInitialized: boolean) => void
    clearError: () => void
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    reload: () => Promise<void>
    initialize: () => Promise<void>
    loadUser: () => Promise<void>
    loadRoles: () => Promise<void>
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>((set, get) => ({
    // Initial state
    user: null,
    roles: [],
    isLoading: false,
    error: null,
    isInitialized: false,

    // Actions
    setUser: (user: User | null) => set({ user }),
    setRoles: (roles: string[]) => set({ roles }),
    setLoading: (isLoading: boolean) => set({ isLoading }),
    setError: (error: string | null) => set({ error }),
    setInitialized: (isInitialized: boolean) => set({ isInitialized }),
    clearError: () => set({ error: null }),

    login: async (email: string, password: string) => {
        try {
            set({ isLoading: true, error: null })

            const response = await zodula.action("zodula.auth.login", {
                data: { email, password }
            })

            if (response?.user) {
                set({
                    user: {
                        ...response.user,
                        id: response.user.id || ""
                    }
                })
                
                // Load roles after successful login
                await get().loadRoles()
            }
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || "Login failed"
            set({ error: errorMessage })
            throw err
        } finally {
            set({ isLoading: false })
        }
    },

    logout: async () => {
        try {
            set({ isLoading: true, error: null })

            await zodula.action("zodula.auth.logout")
            set({ user: null, roles: [] })
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || "Logout failed"
            set({ error: errorMessage })
            throw err
        } finally {
            set({ isLoading: false })
        }
    },

    reload: async () => {
        const { loadUser, loadRoles } = get()
        await loadUser()
        await loadRoles()
    },

    initialize: async () => {
        const { isInitialized, loadUser, loadRoles } = get()
        
        if (isInitialized) return

        set({ isLoading: true, error: null })

        try {
            // Check if we have a session cookie
            const sessionId = getCookie("zodula_sid")
            const userId = getCookie("zodula_user_id")
            const email = getCookie("zodula_email")
            const rolesCookie = getCookie("zodula_roles")

            if (sessionId && userId && email) {
                // Set user from cookies for immediate UI update
                set({
                    user: { id: userId, email },
                    roles: rolesCookie ? rolesCookie.split(",").filter(Boolean) : []
                })

                // Then fetch fresh data from server
                await loadUser()
                await loadRoles()
            } else {
                // No session, clear state
                set({ user: null, roles: [] })
            }
        } catch (err) {
            console.error("Failed to initialize auth:", err)
            set({ user: null, roles: [] })
        } finally {
            set({ isLoading: false, isInitialized: true })
        }
    },

    // Internal methods
    loadUser: async () => {
        try {
            const response = await zodula.action("zodula.auth.me")
            if (response?.user) {
                set({
                    user: {
                        ...response.user,
                        id: response.user.id || ""
                    }
                })
            } else {
                set({ user: null })
            }
        } catch (err) {
            console.error("Failed to load user:", err)
            set({ user: null })
        }
    },

    loadRoles: async () => {
        try {
            const { user } = get()
            if (!user) {
                set({ roles: [] })
                return
            }

            const response = await zodula.action("zodula.auth.roles")
            if (response?.roles) {
                set({ roles: response.roles })
            } else {
                set({ roles: [] })
            }
        } catch (err) {
            console.error("Failed to load roles:", err)
            set({ roles: [] })
        }
    }
}))

export function useAuth() {
    const {
        user,
        roles,
        isLoading,
        error,
        isInitialized,
        login,
        logout,
        reload,
        clearError,
        initialize
    } = useAuthStore()

    // Initialize auth on mount
    useEffect(() => {
        initialize()
    }, [initialize])

    // Computed values
    const isAuthenticated = useMemo(() => {
        return !!user && !!getCookie("zodula_sid")
    }, [user])

    return {
        // State
        user,
        roles,
        isAuthenticated,
        isLoading,
        error,
        isInitialized,

        // Actions
        login,
        logout,
        reload,
        clearError
    }
}