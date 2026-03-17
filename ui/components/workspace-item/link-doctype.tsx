import { Link, useParams } from "react-router"
import { useState, useEffect } from "react"
import { BaseWorkspaceItemPlugin } from "./base"
import { BookIcon } from "lucide-react"
import { cn } from "../../lib/utils"
import { FormControl } from "../ui/form-control"
import { Badge } from "../ui/badge"
import { useTranslation } from "../../hooks/use-translation"
import { useDocListAll } from "../../hooks/use-doc-list-all"
import { zodula } from "@/zodula/client"

function parseFilters(filtersStr: string | null | undefined): [string, string, unknown][] | null {
    if (!filtersStr?.trim()) return null
    try {
        const parsed = JSON.parse(filtersStr) as unknown
        if (!Array.isArray(parsed)) return null
        const valid = parsed.every((row) => Array.isArray(row) && row.length >= 3)
        return valid ? (parsed as [string, string, unknown][]) : null
    } catch {
        return null
    }
}

export const LinkDoctypePlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%] zd:xl:w-[23.7%]",
    (props) => {
        const item = props.item
        const doctypeId = item?.value ?? ""
        const { t } = useTranslation()
        const { org } = useParams()
        const { docs: doctypes } = useDocListAll({ doctype: "Doctype" })
        const [count, setCount] = useState<number | null>(null)

        const filters = parseFilters(item?.filters ?? "")

        useEffect(() => {
            if (!doctypeId || !filters || filters.length === 0) {
                setCount(null)
                return
            }

            let cancelled = false
            const payload = {
                data: {
                    docFilters: [{ doctype: doctypeId, filters }]
                }
            }

            zodula
                .action("zodula.core.count" as Zodula.ActionPath, payload as any)
                .then((data: { results?: { count?: number }[] }) => {
                    if (cancelled) return
                    const c = data?.results?.[0]?.count
                    setCount(typeof c === "number" ? c : null)
                })
                .catch(() => {
                    if (cancelled) return
                    setCount(null)
                })

            return () => {
                cancelled = true
            }
        }, [doctypeId, item?.filters])

        const showBadge = filters && filters.length > 0 && count !== null
        const badgeVariant = (item?.badge_variant as "default" | "secondary" | "destructive" | "warning" | "success" | "outline" | "draft" | "submitted" | "cancelled" | "pending" | "approved" | "rejected" | "muted" | "info") ?? "secondary"

        const listUrl = filters && filters.length > 0
            ? `/desk/${org}/doctypes/${doctypeId}/list?filters=${encodeURIComponent(JSON.stringify(filters))}`
            : `/desk/${org}/doctypes/${doctypeId}`

        const doctypeDoc = doctypes.find((d: any) => d.id === doctypeId) as any

        return (
            <Link
                to={listUrl}
                className={cn(
                    "zd:w-full zd:h-full zd:flex zd:items-center zd:gap-2 zd:p-2 zd:pl-4",
                    !doctypeId ? "zd:italic zd:text-muted-foreground" : "",
                    "zd:hover:underline",
                    "zd:flex-[2]"
                )}
            >
                <BookIcon />
                <span className="zd:flex-1 zd:min-w-0 zd:truncate">
                    {item?.label?.trim()
                        ? t(item.label)
                        : t(doctypeDoc?.label || doctypeDoc?.name || "")}
                </span>
                {showBadge && (
                    <Badge variant={badgeVariant} size="sm">
                        {count}
                    </Badge>
                )}
            </Link>
        )
    },
    {
        name: "Link - Doctype",
        description: "Link to a doctype"
    },
    // renderEditValue: Doctype
    (props) => (
        <FormControl
            field={{
                type: "Virtual Reference",
                reference: "Doctype"
            }}
            label="Doctype"
            value={props.item?.value}
            fieldKey="value"
            onChange={(_fieldKey, value) => props.onChange("value", value)}
        />
    ),
    // renderEditOptions: Filters + Badge variant
    (props) => {
        const BADGE_VARIANTS = [
            "default", "secondary", "destructive", "warning", "success", "outline",
            "draft", "submitted", "cancelled", "pending", "approved", "rejected", "muted", "info"
        ]
        return (
            <div className="zd:space-y-4">
                <FormControl
                    field={{ type: "Text", label: "Label" }}
                    label="Label"
                    value={props.item?.label ?? ""}
                    fieldKey="label"
                    onChange={(_k, value) => props.onChange("label", value)}
                    placeholder="Override display name (optional)"
                />
                <FormControl
                    field={{ type: "Code", label: "Filters", options: "json" }}
                    label="Filters"
                    value={props.item?.filters ?? ""}
                    fieldKey="filters"
                    onChange={(_k, value) => props.onChange("filters", value)}
                    placeholder='e.g. [["doc_status","=","Submitted"]]'
                />
                <FormControl
                    label="Badge Variant"
                    field={{ type: "Select", label: "Badge Variant", options: BADGE_VARIANTS.join("\n") }}
                    value={props.item?.badge_variant ?? ""}
                    fieldKey="badge_variant"
                    onChange={(_k, value) => props.onChange("badge_variant", value)}
                />
            </div>
        )
    }
)