import { Badge } from "../ui/badge";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

export function DocStatusBadge({ status, variant, size }: { status: "Draft" | "Submitted" | "Cancelled", variant?: "draft" | "submitted" | "cancelled", size?: "sm" | "lg" | "xl" }) {
    const { t } = useTranslation();
    const statusMap: Record<string, string> = {
        "Draft": "Draft",
        "Submitted": "Submitted",
        "Cancelled": "Cancelled"
    }
    const variantMap: Record<string, string> = {
        "Draft": "draft",
        "Submitted": "submitted",
        "Cancelled": "cancelled"
    }
    return <Badge variant={variant || variantMap[status] as any} size={size || "sm"}>{t(statusMap[status] || "")}</Badge>
}