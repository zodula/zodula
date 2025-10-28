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
import { useEffect } from "react";
import type { GenerateMetadata } from "../components/metadata";

export const generateMetadata: GenerateMetadata = async (ctx) => {
    return {
        title: "Zodula Framework",
        description: "Zodula Framework",
        fonts: [
            {
                family: "Prompt",
                src: "/public/zodula/fonts/Prompt/Prompt-Light.ttf",
                weight: "300",
                style: "normal",
                display: "swap",
            },
            {
                family: "Prompt",
                src: "/public/zodula/fonts/Prompt/Prompt-Light.ttf",
                weight: "400",
                style: "normal",
                display: "swap",
            },
            {
                family: "Prompt",
                src: "/public/zodula/fonts/Prompt/Prompt-Regular.ttf",
                weight: "500",
                style: "normal",
                display: "swap",
            },
            {
                family: "Prompt",
                src: "/public/zodula/fonts/Prompt/Prompt-Medium.ttf",
                weight: "600",
                style: "normal",
                display: "swap",
            },
            {
                family: "Prompt",
                src: "/public/zodula/fonts/Prompt/Prompt-SemiBold.ttf",
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
    if ((!isAuthenticated || !user) && router.pathname.startsWith("/desk")) {
        return <AuthErrorView message="Authentication required" />
    }
    return <div>
        {children}
        {/* <FormLayout
            doctype="zodula__Audit Trail"
            tabs={[
                {
                    label: "Main",
                    layout: [
                        "Doctype",
                        ["doctype", "doctype_id"],
                        ["action", ""],
                        "Value",
                        ["old_value", "new_value"],
                    ]
                },
                {
                    label: "User",
                    layout: [
                        "By",
                        ["by", "by_name"],
                        "At",
                        ["at"],
                        "Comment",
                        ["comment"],
                    ]
                }
            ]}
        /> */}
        <ToastPortal />
        <DialogPortal />
    </div>
}