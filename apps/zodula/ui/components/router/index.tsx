import React, { useEffect, useState } from "react";
import { useMemo } from "react";
import { BrowserRouter, Routes, Route, Link, Outlet, useNavigate, useParams, useLocation, type Location, type Params, type NavigateOptions, StaticRouter, Meta } from "react-router";
export { BrowserRouter, Routes, Route, Link, Outlet }

interface UseRouter {
    push: (path: string, options?: NavigateOptions) => void
    replace: (path: string, options?: NavigateOptions) => void
    go: (n: number) => void
    back: () => void
    forward: () => void
    location: Location
    pathname: string
    search: Record<string, string>
    params: Params
}

function useRouter(): UseRouter {
    const navigate = useNavigate()
    const location = useLocation()
    const params = useParams()

    const search = useMemo(() => {
        return Object.fromEntries(new URLSearchParams(location.search))
    }, [location])
    return {
        push: (path: string, options?: NavigateOptions) => navigate(path, options),
        replace: (path: string, options?: NavigateOptions) => navigate(path, { replace: true, ...options }),
        go: (n: number) => navigate(n),
        back: () => navigate(-1),
        forward: () => navigate(1),
        location: location,
        pathname: location.pathname,
        search: search,
        params: params,
    }
}

export { StaticRouter, Meta }
export { useRouter }