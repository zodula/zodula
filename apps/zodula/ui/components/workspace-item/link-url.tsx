import { ExternalLink, Link2Icon } from "lucide-react"
import { BaseWorkspaceItemPlugin } from "./base"
import { Input } from "../ui/input"
import { cn } from "../../lib/utils"
import { Link } from "react-router"
import { FormControl } from "../ui/form-control"

export const LinkUrlPlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%] zd:xl:w-[23.7%]",
    (props) => {
        const external = props.value?.startsWith("http")
        return (
            <Link
                to={props.value}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={cn(
                    "zd:flex zd:items-center zd:gap-2 zd:p-2 zd:justify-between zd:h-full",
                    !props.value ? "zd:italic zd:text-muted-foreground" : "",
                    !props.isEditing ? "zd:border zd:rounded-lg zd:hover:shadow-sm zd:transition-shadow" : "",
                    "zd:flex-[2]"
                )}
            >
                <span>
                    {props.value}
                </span>
                {external ? <ExternalLink /> : <Link2Icon />}
            </Link>
        )
    },
    {
        name: "Link - URL",
        description: "Link to a URL"
    },
    // renderEditValue
    (props) => (
        <FormControl
            field={{
                type: "Text",
                label: "URL"
            }}
            value={props.value || ""}
            fieldKey="value"
            helperText={`Example: "https://www.google.com" or internal link like "/desk/doctypes/zodula__Doctype/list"`}
            onChange={(fieldKey, value) => props.onChange(value)}
        />
    ),
    // renderEditOptions
    (props) => (
        <Input
            value={props.value || ""}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="Enter additional options"
        />
    )
)
