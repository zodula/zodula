import { Link } from "react-router"
import { useRouter } from "../router"
import { BuildingIcon, ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTranslation } from "../../hooks/use-translation"
import { useWorkspace } from "../workspace/use-workspace"

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

/** Format a raw URL path segment into a readable label */
function formatSegment(seg: string): string {
    const decoded = decodeURIComponent(seg)
    // If it looks like an ID (contains digits/dashes after letters), keep case as-is
    // Otherwise capitalise first letter
    return decoded.charAt(0).toUpperCase() + decoded.slice(1)
}

/** Build the workspace ancestor chain as breadcrumb items */
function buildWorkspaceChain(
    workspace: any,
    allWorkspaces: any[],
    t: (k: string) => string
): BreadcrumbItem[] {
    const chain: BreadcrumbItem[] = []
    let current: any = workspace
    while (current) {
        chain.unshift({
            label: t(decodeURIComponent(current.name)),
            href: current.url ?? undefined
        })
        current = current.workspace_parent
            ? allWorkspaces.find((w) => w.id === current.workspace_parent)
            : null
    }
    return chain
}

/**
 * Find the workspace whose URL best matches the given decoded path.
 * Prefers an exact match; falls back to the workspace whose URL shares
 * the most leading path segments with the decoded path.
 *
 * Threshold: ALL segments of the workspace URL except the last one must match.
 * e.g. workspace "/desk/doctypes/Sales Invoice/list" (4 segs) requires score ≥ 3,
 * so "/desk/doctypes/Payment Entry/list" (score=2) is rejected.
 * But "/desk/doctypes/Sales Invoice/form/SINV-001" (score=3) is accepted.
 */
function findBestWorkspace(workspaces: any[], decodedPath: string): any | null {
    // 1. Exact match
    const exact = workspaces.find((w) => w.url && w.url === decodedPath)
    if (exact) return exact

    // 2. Prefix match — all URL segments except the last must match the path
    const pathParts = decodedPath.split('/').filter(Boolean)
    let best: any = null
    let bestScore = 0

    for (const w of workspaces) {
        if (!w.url) continue
        const urlParts = w.url.split('/').filter(Boolean)
        if (urlParts.length < 2) continue

        let score = 0
        for (let i = 0; i < Math.min(pathParts.length, urlParts.length); i++) {
            if (pathParts[i] === urlParts[i]) score++
            else break
        }

        // Require score to cover at least all-but-last segment of the workspace URL
        const required = urlParts.length - 1
        if (score >= required && score > bestScore) {
            bestScore = score
            best = w
        }
    }

    return best
}

export const Breadcrumb = ({ className = "", items, showHome = true }: BreadcrumbProps) => {
    const router = useRouter()
    const { t } = useTranslation()
    const { workspaces } = useWorkspace()

    const generateBreadcrumb = (): BreadcrumbItem[] => {
        const decodedPathname = decodeURIComponent(router.pathname)
        const homeItem: BreadcrumbItem = {
            label: "Desk",
            href: `/desk`,
            icon: <BuildingIcon className="zd:w-4 zd:h-4" />
        }

        // --- Workspace URL lookup (exact or nearest prefix) ---
        const matchedWorkspace = findBestWorkspace(workspaces, decodedPathname)

        if (matchedWorkspace) {
            // Ancestor chain from root → matched workspace
            const wsChain = buildWorkspaceChain(matchedWorkspace, workspaces, t)

            // Remaining path segments after the workspace URL
            const wsUrlParts = (matchedWorkspace.url as string).split('/').filter(Boolean)
            const pathParts = decodedPathname.split('/').filter(Boolean)
            const remaining = pathParts.slice(wsUrlParts.length)

            const remainingItems: BreadcrumbItem[] = remaining.map((seg, i) => ({
                label: t(formatSegment(seg)),
                href: '/' + pathParts.slice(0, wsUrlParts.length + i + 1).join('/')
            }))

            const allItems = [...wsChain, ...remainingItems]
            return showHome ? [homeItem, ...allItems] : allItems
        }

        // --- Fallback: plain pathname-based breadcrumb ---
        const pathSegments = router.pathname.split('/').filter(Boolean)
        const breadcrumbItems: BreadcrumbItem[] = []

        if (showHome) breadcrumbItems.push(homeItem)

        if (pathSegments.length >= 2 && pathSegments[1] === "doctypes") {
            const doctype = pathSegments[2]
            breadcrumbItems.push({
                label: t(decodeURIComponent(doctype || "")),
                href: `/desk/doctypes/${doctype}`
            })
            if (pathSegments.length >= 4) {
                const action = pathSegments[3]
                if (action === "list") {
                    breadcrumbItems.push({ label: t("List"), href: `/desk/doctypes/${doctype}/list` })
                } else if (action === "form") {
                    const id = pathSegments[4]
                    if (id) {
                        breadcrumbItems.push({ label: t("Form"), href: `/desk/doctypes/${doctype}/form` })
                        breadcrumbItems.push({ label: decodeURIComponent(id), href: router.pathname })
                    } else {
                        breadcrumbItems.push({ label: t("New"), href: `/desk/doctypes/${doctype}/form` })
                    }
                }
            }
        } else if (pathSegments.length > 1) {
            pathSegments.slice(1).forEach((segment, i) => {
                breadcrumbItems.push({
                    label: t(formatSegment(segment)),
                    href: '/' + pathSegments.slice(0, i + 2).join('/')
                })
            })
        }

        return breadcrumbItems
    }

    const rawItems = items || generateBreadcrumb()

    // Append current search params to the last item's href so navigating
    // back to it preserves filters, tabs, and other query state.
    const breadcrumbItems = rawItems.map((item, index) => {
        if (index !== rawItems.length - 1) return item
        if (!item.href || !router.location.search) return item
        return { ...item, href: item.href + router.location.search }
    })

    return (
        <nav className={cn("zd:font-medium zd:flex zd:items-center zd:space-x-1 zd:text-muted-foreground zd:overflow-hidden", className)}>
            {breadcrumbItems.map((item, index) => (
                <div key={index} className="zd:flex zd:items-center zd:space-x-1 zd:w-fit zd:shrink-0">
                    {index > 0 && (
                        <ChevronRight className="zd:w-3.5 zd:h-3.5 zd:mx-0.5 zd:flex-shrink-0 zd:opacity-50" />
                    )}
                    {item.href ? (
                        <Link
                            to={item.href}
                            className="zd:flex zd:items-center zd:gap-1 zd:hover:text-foreground zd:transition-colors zd:truncate zd:max-w-[180px] zd:text-sm"
                            title={item.label}
                        >
                            {item.icon}
                            <span className="zd:truncate">{item.label}</span>
                        </Link>
                    ) : (
                        <span
                            className="zd:flex zd:items-center zd:gap-1 zd:truncate zd:max-w-[180px] zd:text-foreground zd:text-sm"
                            title={item.label}
                        >
                            {item.icon}
                            <span className="zd:truncate">{item.label}</span>
                        </span>
                    )}
                </div>
            ))}
        </nav>
    )
}
