import { ExternalLink, Link2Icon } from "lucide-react"
import { BaseWorkspaceItemPlugin } from "./base"
import { Input } from "../ui/input"
import { cn } from "../../lib/utils"
import { Link } from "react-router"
import { FormControl } from "../ui/form-control"
import { useMemo } from "react"

export const LinkUrlPlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%] zd:xl:w-[23.7%]",
    (props) => {
        const item = props.item
        const url = item?.url ?? item?.value ?? ""
        const external = url?.startsWith("http")
        const toUrl = useMemo(() => {
            return url
        }, [url])
        const label = item?.label ?? url
        return (
            <Link
                to={toUrl}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={cn(
                    "zd:flex zd:items-center zd:gap-2 zd:p-2 zd:h-full",
                    !url ? "zd:italic zd:text-muted-foreground" : "",
                    "zd:hover:underline",
                    "zd:flex-[2]"
                )}
            >
                {external ? <ExternalLink /> : <Link2Icon />}
                <span>{label || "—"}</span>
            </Link>
        )
    },
    {
        name: "Link - URL",
        description: "Link to a URL"
    },
    // renderEditValue: URL
    (props) => (
        <FormControl
            field={{
                type: "Text",
                label: "URL"
            }}
            label="URL"
            value={props.item?.url ?? props.item?.value ?? ""}
            fieldKey="url"
            helperText={`Example: "https://www.google.com" or internal link like "/desk/doctypes/Doctype/list"`}
            onChange={(_fieldKey, value) => props.onChange("url", value)}
        />
    ),
    // renderEditOptions: Label
    (props) => (
        <FormControl
            field={{
                type: "Text",
                label: "Label"
            }}
            label="Label"
            value={props.item?.label ?? ""}
            fieldKey="label"
            onChange={(_fieldKey, value) => props.onChange("label", value)}
        />
    )
)
