import { Link } from "react-router"
import { BaseWorkspaceItemPlugin } from "./base"
import { BookIcon, Database, FileIcon } from "lucide-react"
import { cn } from "../../lib/utils"
import { Input } from "../ui/input"
import { FormControl } from "../ui/form-control"
import { useDoc } from "../../hooks/use-doc"
import { useTranslation } from "../../hooks/use-translation"

export const LinkDoctypePlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%] zd:xl:w-[23.7%]",
    (props) => {
        const { t } = useTranslation()
        const { doc } = useDoc({
            doctype: "zodula__Doctype",
            id: props.value
        })
        return (
            <Link
                to={`/desk/doctypes/${props.value}`}
                className={cn(
                    "zd:w-full zd:h-full zd:flex zd:items-center zd:gap-2 zd:p-2 zd:pl-4",
                    !props.value ? "zd:italic zd:text-muted-foreground" : "",
                    !props.isEditing ? "zd:border zd:rounded-lg zd:hover:shadow-sm zd:transition-shadow" : "",
                    "zd:flex-[2]"
                )}
            >
                <BookIcon />
                {t(doc?.label || doc?.name || "")}
            </Link>
        )
    },
    {
        name: "Link - Doctype",
        description: "Link to a doctype"
    },
    // renderEditValue
    (props) => (
        <FormControl
            field={{
                type: "Virtual Reference",
                reference: "zodula__Doctype"
            }}
            value={props.value}
            fieldKey="value"
            onChange={(fieldKey, value) => {
                props.onChange(value)
            }}
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