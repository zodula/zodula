import { Link } from "react-router"
import { useRouter } from "../router"
import { ChevronRight, Home } from "lucide-react"
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
    const { t } = useTranslation()

    // Auto-generate breadcrumb from current path if no items provided
    const generateBreadcrumb = (): BreadcrumbItem[] => {
        const pathSegments = router.pathname.split('/').filter(Boolean)
        const breadcrumbItems: BreadcrumbItem[] = []

        if (showHome) {
            breadcrumbItems.push({
                label: t("Home"),
                href: "/desk",
                icon: <Home className="zd:w-4 zd:h-4" />
            })
        }

        // Handle different route patterns
        if (pathSegments.length >= 3 && pathSegments[1] === "doctypes") {
            const doctype = pathSegments[2]

            // Add doctype breadcrumb
            breadcrumbItems.push({
                label: t(decodeURIComponent(doctype?.split("__")?.[1] || "")),
                href: `/desk/doctypes/${doctype}`
            })

            // Handle specific doctype actions
            if (pathSegments.length >= 4) {
                const action = pathSegments[3]

                if (action === "list") {
                    breadcrumbItems.push({
                        label: t("List"),
                        href: `/desk/doctypes/${doctype}/list`
                    })
                } else if (action === "form") {
                    const id = pathSegments[4]
                    if (pathSegments.length >= 5) {
                        // Edit existing document
                        breadcrumbItems.push({
                            label: t("Edit"),
                            href: router.pathname
                        })
                        breadcrumbItems.push({
                            label: t(decodeURIComponent(id || "")),
                            href: `/desk/doctypes/${doctype}/form/${id || ""}`
                        })
                    } else {
                        // Create new document
                        breadcrumbItems.push({
                            label: t("New"),
                            href: `/desk/doctypes/${doctype}/form`
                        })
                    }
                }
            }
        }

        return breadcrumbItems
    }

    const breadcrumbItems = items || generateBreadcrumb()

    if (breadcrumbItems.length <= 1) {
        return null
    }

    return (
        <nav className={cn("zd:flex zd:items-center zd:space-x-1 zd:text-muted-foreground zd:overflow-hidden", className)}>
            {breadcrumbItems.map((item, index) => (
                <div key={index} className="zd:flex zd:items-center zd:space-x-1 zd:w-fit">
                    {index > 0 && (
                        <ChevronRight className="zd:w-4 zd:h-4 zd:mx-1 zd:flex-shrink-0" />
                    )}
                    {item.href && index < breadcrumbItems.length - 1 ? (
                        <Link
                            to={item.href}
                            className="zd:flex zd:items-center zd:space-x-1 zd:hover:text-foreground zd:transition-colors zd:truncate zd:max-w-[200px]"
                            title={item.label}
                        >
                            {item.icon}
                            <span className="zd:truncate">{item.label}</span>
                        </Link>
                    ) : (
                        <span className="zd:flex zd:items-center zd:space-x-1 zd:truncate zd:max-w-[200px]">
                            {item.icon}
                            <span className="zd:text-foreground zd:font-medium zd:truncate" title={item.label}>{item.label}</span>
                        </span>
                    )}
                </div>
            ))}
        </nav>
    )
}

// Hook to get breadcrumb for current route
export const useBreadcrumb = () => {
    const router = useRouter()
    const { t } = useTranslation()

    const getBreadcrumb = (): BreadcrumbItem[] => {
        const pathSegments = router.pathname.split('/').filter(Boolean)
        const breadcrumbItems: BreadcrumbItem[] = []

        breadcrumbItems.push({
            label: t("Home"),
            href: "/desk",
            icon: <Home className="zd:w-4 zd:h-4" />
        })

        // Handle different route patterns
        if (pathSegments.length >= 3 && pathSegments[1] === "doctypes") {
            const doctype = pathSegments[2]

            // Add doctype breadcrumb
            breadcrumbItems.push({
                label: t(doctype || ""),
                href: `/desk/doctypes/${doctype}`
            })

            // Handle specific doctype actions
            if (pathSegments.length >= 4) {
                const action = pathSegments[3]

                if (action === "list") {
                    breadcrumbItems.push({
                        label: t("List"),
                        href: `/desk/doctypes/${doctype}/list`
                    })
                } else if (action === "form") {
                    if (pathSegments.length >= 5) {
                        // Edit existing document
                        breadcrumbItems.push({
                            label: t("Edit"),
                            href: router.pathname
                        })
                    } else {
                        // Create new document
                        breadcrumbItems.push({
                            label: t("New"),
                            href: `/desk/doctypes/${doctype}/form`
                        })
                    }
                }
            }
        }

        return breadcrumbItems
    }

    return {
        items: getBreadcrumb(),
        Breadcrumb: (props: Omit<BreadcrumbProps, 'items'>) => <Breadcrumb {...props} items={getBreadcrumb()} />
    }
}
