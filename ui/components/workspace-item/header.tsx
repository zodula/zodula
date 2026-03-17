import { BaseWorkspaceItemPlugin } from "./base"
import { FormControl } from "../ui/form-control"
import { cn } from "../../lib/utils"

const fontSizes = {
    1: "zd:text-4xl",
    2: "zd:text-3xl",
    3: "zd:text-2xl",
    4: "zd:text-xl",
    5: "zd:text-lg",
    6: "zd:text-base"
}

export const HeaderPlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%]",
    (props) => {
        const item = props.item
        const level = item?.heading_level ? parseInt(String(item.heading_level)) : 2
        const safeLevel = Math.min(Math.max(level, 1), 6)
        const Tag = `h${safeLevel}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
        return (
            <Tag className={cn("zd:font-semibold zd:text-foreground zd:flex zd:items-center zd:gap-2 zd:px-2 zd:justify-between zd:h-full zd:flex-[8]", fontSizes[safeLevel as keyof typeof fontSizes])}>
                {item?.value || "Header"}
            </Tag>
        )
    },
    {
        name: "Header",
        description: "Header"
    },
    (props) => (
        <FormControl
            field={{ type: "Text", label: "Header" }}
            label="Header"
            value={props.item?.value ?? ""}
            fieldKey="value"
            onChange={(_k, value) => props.onChange("value", value)}
            placeholder="Enter header text"
        />
    ),
    (props) => (
        <FormControl
            field={{ type: "Select", label: "Heading Level", options: "1\n2\n3\n4\n5\n6" }}
            value={props.item?.heading_level ?? "2"}
            fieldKey="heading_level"
            onChange={(_k, value) => props.onChange("heading_level", value)}
        />
    )
)
