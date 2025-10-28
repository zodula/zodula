import { LinkDoctypePlugin } from "./link-doctype"
import { LinkUrlPlugin } from "./link-url"
import { TextPlugin } from "./text"
import { HtmlPlugin } from "./html"
import { HeaderPlugin } from "./header"

export const workspaceItemPlugins = {
    "Link - Doctype": LinkDoctypePlugin,
    "Link - URL": LinkUrlPlugin,
    "Text": TextPlugin,
    "HTML": HtmlPlugin,
    "Header": HeaderPlugin
}