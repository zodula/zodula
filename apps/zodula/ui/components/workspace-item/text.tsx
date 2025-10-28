import { BaseWorkspaceItemPlugin } from "./base"
import { Input } from "../ui/input"

export const TextPlugin = new BaseWorkspaceItemPlugin(
    "zd:flex-[2]",
    (props) => {
        return (
            <span className="zd:flex zd:text-foreground zd:flex zd:items-center zd:gap-2 zd:p-2 zd:justify-between zd:h-full zd:flex-[2]">
                {props.value}
            </span>
        )
    },
    {
        name: "Text",
        description: "Text"
    },
    // renderEditValue
    (props) => (
        <Input
            value={props.value || ""}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="Enter text content"
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
