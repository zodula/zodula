import { BaseWorkspaceItemPlugin } from "./base"
import { FormControl } from "../ui/form-control"

export const TextPlugin = new BaseWorkspaceItemPlugin(
    "zd:flex-[2]",
    (props) => {
        const content = props.item?.text ?? props.item?.value ?? ""
        return (
            <span className="zd:flex zd:text-foreground zd:flex zd:items-center zd:gap-2 zd:p-2 zd:justify-between zd:h-full zd:flex-[2]">
                {content}
            </span>
        )
    },
    {
        name: "Text",
        description: "Text"
    },
    (props) => (
        <FormControl
            field={{ type: "Text", label: "Text" }}
            label="Text"
            value={props.item?.text ?? props.item?.value ?? ""}
            fieldKey="text"
            onChange={(_k, value) => props.onChange("text", value)}
            placeholder="Enter text content"
        />
    ),
    undefined
)
