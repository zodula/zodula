import { BaseWorkspaceItemPlugin } from "./base"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
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
        const level = props.options ? parseInt(props.options) : 2
        const Tag = `h${Math.min(Math.max(level, 1), 6)}` as any

        return (
            <Tag className={cn("zd:font-semibold zd:text-foreground zd:mb-2 zd:flex zd:items-center zd:gap-2 zd:p-2 zd:justify-between zd:h-full zd:flex-[8]", fontSizes[level as keyof typeof fontSizes])}>
                {props.value || "Header"}
            </Tag>
        )
    },
    {
        name: "Header",
        description: "Header"
    },
    // renderEditValue
    (props) => (
        <Input
            value={props.value || ""}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="Enter header text"
        />
    ),
    // renderEditOptions
    (props) => (
        <Select
            value={props.value || "2"}
            onChange={(value) => props.onChange(value)}
            options={[
                { value: "1", label: "H1" },
                { value: "2", label: "H2" },
                { value: "3", label: "H3" },
                { value: "4", label: "H4" },
                { value: "5", label: "H5" },
                { value: "6", label: "H6" }
            ]}
            placeholder="Select header level"
        />
    )
)
