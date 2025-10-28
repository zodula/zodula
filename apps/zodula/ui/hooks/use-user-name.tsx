import { useCallback, useEffect, useState } from "react";
import { zodula } from "@/zodula/client";

// In-memory cache for usernames
const usernameCache = new Map<string, string>();

interface UserName {
    id: string;
    name: string;
}

interface UseUserNameOptions {
    userIds: string[];
    enabled?: boolean;
}

interface UseUserNameReturn {
    usernames: Map<string, string>;
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
    getUserName: (userId: string) => string | undefined;
}

export function useUserName({ userIds, enabled = true }: UseUserNameOptions): UseUserNameReturn {
    const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper function to get username from cache or return undefined
    const getUserName = useCallback((userId: string): string | undefined => {
        return usernames.get(userId) || usernameCache.get(userId);
    }, [usernames]);

    // Function to load missing usernames
    const loadMissingUsernames = useCallback(async () => {
        if (!enabled || !userIds.length) return;

        // Find user IDs that are not in cache
        const missingUserIds = userIds.filter(id => !usernameCache.has(id));
        
        if (missingUserIds.length === 0) {
            // All usernames are in cache, just update the state
            const cachedUsernames = new Map<string, string>();
            userIds.forEach(id => {
                const cachedName = usernameCache.get(id);
                if (cachedName) {
                    cachedUsernames.set(id, cachedName);
                }
            });
            setUsernames(cachedUsernames);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await zodula.action("zodula.auth.getUserNames", {
                data: { ids: missingUserIds }
            });

            if (response?.users) {
                // Update cache with new usernames
                response.users.forEach((user: UserName) => {
                    usernameCache.set(user.id, user.name);
                });

                // Update state with all usernames (cached + new)
                const allUsernames = new Map<string, string>();
                userIds.forEach(id => {
                    const cachedName = usernameCache.get(id);
                    if (cachedName) {
                        allUsernames.set(id, cachedName);
                    }
                });
                setUsernames(allUsernames);
            }
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || "Failed to load usernames";
            setError(errorMessage);
            console.error("Error loading usernames:", err);
        } finally {
            setLoading(false);
        }
    }, [userIds, enabled]);

    // Reload function for manual refresh
    const reload = useCallback(async () => {
        // Clear cache for the current user IDs to force reload
        userIds.forEach(id => {
            usernameCache.delete(id);
        });
        await loadMissingUsernames();
    }, [userIds, loadMissingUsernames]);

    // Effect to load usernames when userIds change
    useEffect(() => {
        loadMissingUsernames();
    }, [loadMissingUsernames]);

    return {
        usernames,
        loading,
        error,
        reload,
        getUserName
    };
}

// Utility hook for getting a single username
export function useSingleUserName(userId: string | undefined, enabled: boolean = true) {
    const { getUserName, loading, error } = useUserName({
        userIds: userId ? [userId] : [],
        enabled: enabled && !!userId
    });

    return {
        userName: userId ? getUserName(userId) : undefined,
        loading,
        error
    };
}

// Utility hook for getting multiple usernames with a simple interface
export function useMultipleUserNames(userIds: string[], enabled: boolean = true) {
    const { usernames, loading, error, reload } = useUserName({
        userIds,
        enabled
    });

    return {
        usernames: Object.fromEntries(usernames),
        loading,
        error,
        reload
    };
}
