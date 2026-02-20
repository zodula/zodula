// @ts-ignore
import { DialogPortal } from "../components/ui/popit";
import "@/zodula/ui/styles/global.css"
import { configureToast, ToastPortal } from "@/zodula/ui/components/ui/toast";
import { Slot, useRouter, FormLayout, type Metadata } from "@/zodula/ui";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import AuthErrorView from "../views/auth-error-view";
import ErrorView from "../views/error-view";
import LoadingView from "../views/loading-view";
import { zodula, setOrganizationGetter } from "@/zodula/client/zodula";
import { getOrganizationId } from "../hooks/use-organization";
import { useEffect, useMemo } from "react";
import type { GenerateMetadata } from "../components/metadata";
import { useOrganizationStore } from "../hooks/use-organization";
import { useDoc } from "../hooks/use-doc";

export const generateMetadata: GenerateMetadata = async (ctx) => {
    return {
        title: "Zodula Framework",
        description: "Zodula Framework",
        fonts: [
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-Thin.ttf",
                weight: "100",
                style: "normal",
                display: "swap",
            },
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-ExtraLight.ttf",
                weight: "200",
                style: "normal",
                display: "swap",
            },
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-Light.ttf",
                weight: "300",
                style: "normal",
                display: "swap",
            },
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-Regular.ttf",
                weight: "400",
                style: "normal",
                display: "swap",
            },
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-Medium.ttf",
                weight: "500",
                style: "normal",
                display: "swap",
            },
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-SemiBold.ttf",
                weight: "600",
                style: "normal",
                display: "swap",
            },
            {
                family: "IBM Plex Sans Thai",
                src: "/public/zodula/fonts/IBM/IBMPlexSansThai-Bold.ttf",
                weight: "700",
                style: "normal",
                display: "swap",
            }
        ],
    }
}

configureToast({
    position: "bottom-right",
})
export default function Shell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user, isLoading } = useAuth()
    const { organization, setOrganization, setLoading, setError } = useOrganizationStore()
    const router = useRouter()

    // Extract org slug from pathname: /desk/:org/...
    const orgSlug = useMemo(() => {
        const pathname = router.pathname || "";
        if (!pathname.startsWith("/desk/")) return null;
        const parts = pathname.split("/");
        // ["", "desk", ":org", ...]
        const res = parts.length >= 3 ? parts[2] || null : null;
        // decode the slug
        return res ? decodeURIComponent(res) : null;
    }, [router]);

    // Fetch organization based on org slug
    const {
        doc: fetchedOrganization,
        loading: orgLoading,
        error: orgError,
        reload: reloadOrganization,
    } = useDoc(
        {
            doctype: "Organization",
            id: orgSlug || "",
        },
        [orgSlug]
    );

    useEffect(() => {
        reloadOrganization();
    }, [orgSlug]);

    // Sync fetched organization into context
    useEffect(() => {
        if (!router.pathname.startsWith("/desk/")) {
            setOrganization(null);
            setLoading(false);
            setError(null);
            return;
        }

        setOrganization(fetchedOrganization);
        setLoading(orgLoading);
        setError(orgError);
    }, [router.pathname, fetchedOrganization, orgLoading, orgError, setOrganization, setLoading, setError]);

    // Persist selected org to localStorage
    useEffect(() => {
        if (orgSlug) {
            localStorage.setItem("zodula-selected-organization", orgSlug);
        }
    }, [orgSlug]);

    // Register organization getter with zodula client
    useEffect(() => {
        setOrganizationGetter(() => getOrganizationId());
    }, []);

    // Load theme from localStorage on component mount
    useEffect(() => {
        zodula.theme.loadTheme()
    }, [])
    if (isLoading) {
        return <LoadingView message="Loading..." size="medium" className="zd:h-screen" />
    }
    if (router.pathname.startsWith("/desk") && process.env.ZODULA_PUBLIC_DISABLE_ADMIN === "true") {
        return <ErrorView message="Admin is disabled" status={404} />
    }
    if(router.pathname.startsWith("/desk/") && !organization?.id) {
        return <ErrorView message="Organization is not found, please select an organization" status={404} />
    }
    if ((!isAuthenticated || !user) && router.pathname.startsWith("/desk")) {
        return <AuthErrorView message="Authentication required" />
    }
    return <div>
        {children}
        <ToastPortal />
        <DialogPortal />
    </div>
}