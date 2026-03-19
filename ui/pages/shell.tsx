// @ts-ignore
import { DialogPortal } from "../components/ui/popit";
import "@/zodula/ui/styles/global.css"
import { configureToast, ToastPortal } from "@/zodula/ui/components/ui/toast";
import { Slot, useRouter, FormLayout, type Metadata } from "@/zodula/ui";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import AuthErrorView from "../views/auth-error-view";
import ErrorView from "../views/error-view";
import LoadingView from "../views/loading-view";
import { zodula } from "@/zodula/client/zodula";
import React, { useEffect, useMemo } from "react";
import type { GenerateMetadata } from "../components/metadata";
import { ErrorBoundary } from "../components/custom/error-boundary";
import { OnboardingChecklistBox } from "../components/onboarding/OnboardingChecklistBox";
import { useOrganizationStore } from "../hooks/use-organization";

export const generateMetadata: GenerateMetadata = async (ctx) => {
    return {
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
    const router = useRouter()
    const { setOrganization, setLoading: setOrgLoading, setError: setOrgError } = useOrganizationStore()

    // Load theme from localStorage on component mount
    useEffect(() => {
        zodula.theme.loadTheme()
    }, [])

    // Load Organization (single-tenant) once at startup
    useEffect(() => {
        let mounted = true
        setOrgLoading(true)
        setOrgError(null)
        zodula.get_action("zodula.org.getInfo" as Zodula.ActionPath, {})
            .then((res: any) => {
                if (!mounted) return
                setOrganization(res?.org ?? null)
            })
            .catch((e: any) => {
                if (!mounted) return
                setOrganization(null)
                setOrgError(e?.message ?? "Failed to load organization")
            })
            .finally(() => {
                if (!mounted) return
                setOrgLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [setOrganization, setOrgLoading, setOrgError])
    if (isLoading) {
        return <LoadingView message="Loading..." size="medium" className="zd:h-screen" />
    }
    if (router.pathname.startsWith("/desk") && process.env.ZODULA_PUBLIC_DISABLE_ADMIN === "true") {
        return <ErrorView message="Admin is disabled" status={404} />
    }
    if ((!isAuthenticated || !user) && router.pathname.startsWith("/desk")) {
        return <AuthErrorView message="Authentication required" />
    }
    return <ErrorBoundary>
        {children}
        {router.pathname.startsWith("/desk") && <OnboardingChecklistBox />}
        <ToastPortal />
        <DialogPortal />
    </ErrorBoundary>
}