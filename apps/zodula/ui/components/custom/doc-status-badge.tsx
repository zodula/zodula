import { Badge } from "../ui/badge";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

export function DocStatusBadge({ status, variant, size }: { status: number, variant?: "draft" | "submitted" | "cancelled", size?: "sm" | "lg" | "xl" }) {
    const { t } = useTranslation();
    const statusMap: Record<number, string> = {
        0: "Draft",
        1: "Submitted",
        2: "Cancelled"
    }
    const variantMap: Record<number, string> = {
        0: "draft",
        1: "submitted",
        2: "cancelled"
    }
    return <Badge variant={variant || variantMap[status] as any} size={size || "sm"}>{t(statusMap[status] || "")}</Badge>
}