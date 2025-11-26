import { BaseWorkspaceItemPlugin } from "./base"
import { Textarea } from "../ui/textarea"
import MyEditor from "../custom/editor"

export const HtmlPlugin = new BaseWorkspaceItemPlugin(
    "zd:w-[100%]",
    (props) => {
        return (
            <div
                className="zd:prose zd:max-w-none"
                dangerouslySetInnerHTML={{ __html: props.value || '' }}
            />
        )
    },
    {
        name: "HTML",
        description: "HTML"
    },
    // renderEditValue
    (props) => (
        <MyEditor
            value={props.value || ""}
            onChange={(value) => props.onChange(value)}
            language="html"
            height={280}
        />
    ),
    // renderEditOptions
    (props) => (
        <Textarea
            value={props.value || ""}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="Enter additional options"
            rows={3}
        />
    )
)
