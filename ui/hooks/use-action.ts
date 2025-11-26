import { useCallback, useEffect, useState } from "react";
import { zodula } from "@/zodula/client";

export function useAction<ActionPath extends Zodula.ActionPath>(action: ActionPath, options: {
    data?: Zodula.ActionRequest[ActionPath]
    params?: Record<string, string>
    method?: "get" | "post"
}, deps: any[] = []) {
    const [data, setData] = useState<Zodula.ActionResponse[ActionPath]>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const method = options?.method || "post"
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await zodula?.[method == "post" ? "action" : "get_action"](action, {
                data: options?.data,
                params: options?.params
            })
            setData(response)
        }
        finally {
            setLoading(false)
        }
    }, [action, options])

    useEffect(() => {
        fetchData()
    }, [...deps])

    return { data, error, loading, reload: fetchData }
}