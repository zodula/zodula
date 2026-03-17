import { BaseWorkspaceItemPlugin } from "./base"
import { FormControl } from "../ui/form-control"

export const HtmlPlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%]",
    (props) => {
        const content = props.item?.html ?? props.item?.value ?? ""
        return (
            <div
                className="zd:prose zd:max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        )
    },
    {
        name: "HTML",
        description: "HTML"
    },
    (props) => (
        <FormControl
            field={{ type: "Code", label: "HTML", options: "html" }}
            label="HTML"
            value={props.item?.html ?? props.item?.value ?? ""}
            fieldKey="html"
            onChange={(_k, value) => props.onChange("html", value)}
        />
    ),
    undefined
)
