import { DeskNavbarLayout } from "@/zodula/ui/layout/desk-navbar-layout"
import { useAuth } from "@/zodula/ui/hooks/use-auth"
import { useTranslation } from "@/zodula/ui/hooks/use-translation"
import { useMemo } from "react"

function getGreeting(hour: number): string {
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
}

export default function DeskPage() {
    const { user } = useAuth()
    const { t } = useTranslation()

    const greeting = useMemo(() => getGreeting(new Date().getHours()), [])
    const displayName = user?.name || user?.email || t("there")

    return (
        <DeskNavbarLayout>
            <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:h-full zd:gap-2 zd:text-center">
                <h1 className="zd:text-2xl zd:font-semibold zd:text-foreground">
                    {t(greeting)}, {displayName} 👋
                </h1>
                <p className="zd:text-sm zd:text-muted-foreground">
                    {t("Select a workspace from the left sidebar to get started.")}
                </p>
            </div>
        </DeskNavbarLayout>
    )
}
