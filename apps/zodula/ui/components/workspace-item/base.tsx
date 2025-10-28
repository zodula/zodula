import type { ReactNode } from "react"

export interface BaseWorkspaceItemPluginOptions {
    name: string
    description: string
}

export class BaseWorkspaceItemPlugin {
    options: BaseWorkspaceItemPluginOptions
    flexClass: string
    render: (props: any) => ReactNode
    renderEditValue?: (props: any) => ReactNode
    renderEditOptions?: (props: any) => ReactNode

    constructor(
        flexClass: string,
        render: (props: any) => ReactNode,
        options: BaseWorkspaceItemPluginOptions,
        renderEditValue?: (props: any) => ReactNode,
        renderEditOptions?: (props: any) => ReactNode
    ) {
        this.flexClass = flexClass
        this.options = options
        this.render = render
        this.renderEditValue = renderEditValue
        this.renderEditOptions = renderEditOptions
    }
}