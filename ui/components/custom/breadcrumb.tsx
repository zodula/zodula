import { Link, useParams } from "react-router"
import { useRouter } from "../router"
import { BuildingIcon, ChevronRight, GlobeIcon, Home } from "lucide-react"
import { cn } from "../../lib/utils"
import { useDoc } from "../../hooks/use-doc"
import { useTranslation } from "../../hooks/use-translation"

export interface BreadcrumbItem {
    label: string
    href?: string
    icon?: React.ReactNode
}

export interface BreadcrumbProps {
    className?: string
    items?: BreadcrumbItem[]
    showHome?: boolean
}

export const Breadcrumb = ({ className = "", items, showHome = true }: BreadcrumbProps) => {
    const router = useRouter()
    const { org } = useParams();
    const { t } = useTranslation()
    // Auto-generate breadcrumb from current path if no items provided
    const generateBreadcrumb = (): BreadcrumbItem[] => {
        const pathSegments = router.pathname.split('/').filter(Boolean)
        const breadcrumbItems: BreadcrumbItem[] = []

        if (showHome) {
            breadcrumbItems.push({
                label: org === "SYS" ? t("SYS") : org || "",
                href: `/desk/${org}`,
                icon: org === "SYS" ? <GlobeIcon className="zd:w-4 zd:h-4" /> : <BuildingIcon className="zd:w-4 zd:h-4" />
            })
        }

        // Handle different route patterns
        if (pathSegments.length >= 3 && pathSegments[2] === "doctypes") {
            const doctype = pathSegments[3]

            // Add doctype breadcrumb
            breadcrumbItems.push({
                label: t(decodeURIComponent(doctype?.split("__")?.[1] || "")),
                href: `/desk/${org}/doctypes/${doctype}`
            })

            // Handle specific doctype actions
            if (pathSegments.length >= 5) {
                const action = pathSegments[4]

                if (action === "list") {
                    breadcrumbItems.push({
                        label: t("List"),
                        href: `/desk/${org}/doctypes/${doctype}/list`
                    })
                } else if (action === "form") {
                    const id = pathSegments[5]
                    if (pathSegments.length >= 6) {
                        // Edit existing document
                        breadcrumbItems.push({
                            label: t("Edit"),
                            href: router.pathname
                        })
                        breadcrumbItems.push({
                            label: t(decodeURIComponent(id || "")),
                            href: `/desk/${org}/doctypes/${doctype}/form/${id || ""}`
                        })
                    } else {
                        // Create new document
                        breadcrumbItems.push({
                            label: t("New"),
                            href: `/desk/${org}/doctypes/${doctype}/form`
                        })
                    }
                }
            }
        }

        return breadcrumbItems
    }

    const breadcrumbItems = items || generateBreadcrumb()

    return (
        <nav className={cn("zd:flex zd:items-center zd:space-x-1 zd:text-muted-foreground zd:overflow-hidden", className)}>
            {breadcrumbItems.map((item, index) => (
                <div key={index} className="zd:flex zd:items-center zd:space-x-1 zd:w-fit">
                    {index > 0 && (
                        <ChevronRight className="zd:w-4 zd:h-4 zd:mx-1 zd:flex-shrink-0" />
                    )}
                    {item.href && (
                        <Link
                        to={item.href}
                        className="zd:flex zd:items-center zd:space-x-1 zd:hover:text-foreground zd:transition-colors zd:truncate zd:max-w-[200px]"
                        title={item.label}
                    >
                        {item.icon}
                        <span className="zd:truncate">{item.label}</span>
                    </Link>
                    )}
                </div>
            ))}
        </nav>
    )
}