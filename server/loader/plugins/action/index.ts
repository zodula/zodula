import { Glob } from "bun"
import { Loader, type BasePlugin } from "../../base"
import path from "path"
import { loader } from "../..";
import { createRoute, type RouteSchema } from "bxo";
import prettier from "prettier";
import { logger } from "../../../logger";

/**
 * Metadata for a loaded action
 */
export interface ActionMetadata {
    /** Path to the action file */
    file_path: string
    /** Name of the function in the file */
    function_name: string
    /** Full action path (app.module.function) */
    action_path: string
    /** Name of the app this action belongs to */
    app_name: string
    /** The action handler function */
    handler: any
    /** Route configuration schema */
    config: RouteSchema | any
}

/**
 * Loader class for action definitions
 * 
 * Handles loading, processing, and validation of action definitions.
 * Generates TypeScript type definitions for action requests and responses.
 */
export class ActionLoader implements BasePlugin<ActionMetadata> {
    /** Internal storage for loaded actions */
    private actions: ActionMetadata[] = [];

    /** Helper for creating route definitions */
    $action = createRoute

    /**
     * Loads all action definitions from the filesystem
     * 
     * Scans for .ts files in apps directories and processes them.
     * Extracts action handlers and their configurations.
     * 
     * @returns Promise resolving to array of loaded action metadata
     */
    async load() {
        const actionGlob = new Glob("apps/*/actions/**/*.ts");

        for await (const actionPath of actionGlob.scan(".")) {
            await this.loadActionsFromFile(actionPath);
        }

        return this.actions;
    }

    /**
     * Loads actions from a single file
     */
    private async loadActionsFromFile(actionPath: string): Promise<void> {
        try {
            const actionImport = await this.importActionFile(actionPath);
            if (!actionImport || !actionImport.default) return;

            const app = this.getAppFromPath(actionPath);
            const moduleName = this.getModuleName(actionPath);

            const actionMetadata = this.createActionMetadata(
                actionPath,
                "default",
                actionImport.default,
                app,
                moduleName
            );

            if (actionMetadata) {
                this.actions.push(actionMetadata);
            }
        } catch (error) {
            logger.error(`Failed to load actions from ${actionPath}:`, error);
        }
    }

    /**
     * Imports an action file with error handling
     */
    private async importActionFile(actionPath: string): Promise<any | null> {
        try {
            return await import(path.resolve(actionPath));
        } catch (error) {
            logger.error(`Failed to import action file ${actionPath}:`, error);
            return null;
        }
    }

    /**
     * Gets app information from file path
     */
    private getAppFromPath(actionPath: string): any {
        return loader.from("app").getAppByPath(actionPath);
    }

    /**
     * Gets module name from file path
     */
    private getModuleName(actionPath: string): string {
        // Extract the path after 'actions/' and before the filename
        const actionsIndex = actionPath.indexOf('/actions/');
        if (actionsIndex === -1) {
            return path.basename(actionPath).replace(".ts", "");
        }
        
        const afterActions = actionPath.substring(actionsIndex + '/actions/'.length);
        const withoutExtension = afterActions.replace('.ts', '');
        return withoutExtension.replace(/\//g, '.');
    }

    /**
     * Creates action metadata from function definition
     */
    private createActionMetadata(
        filePath: string,
        functionName: string,
        functionDef: any,
        app: any,
        moduleName: string
    ): ActionMetadata | null {
        const handler = functionDef?.handler;
        if (!handler) return null;

        const actionPath = `${app?.packageName}.${moduleName}`;

        return {
            file_path: filePath,
            function_name: functionName,
            action_path: actionPath,
            app_name: app?.packageName || "",
            handler: handler,
            config: functionDef?.schema || {}
        };
    }

    /**
     * Gets all loaded actions
     * 
     * @returns Array of action metadata
     */
    list(): ActionMetadata[] {
        return this.actions;
    }

    /**
     * Gets a specific action by path
     * 
     * @param name - The action path to retrieve
     * @returns The action metadata
     * @throws Error if action not found
     */
    get(name: string): ActionMetadata {
        const action = this.actions.find((action) => action.action_path === name);
        if (!action) {
            throw new Error(`Action ${name} not found`);
        }
        return action;
    }

    /**
     * Validates all loaded actions and generates type definitions
     * 
     * Generates TypeScript type definitions for action requests and responses
     * based on the loaded action configurations.
     */
    async validate() {
        try {
            const groupedActions = this.groupActionsByImport();
            const typeDefinitions = await this.generateActionTypes(groupedActions);

            await Bun.write(
                path.join(".zodula", "action.d.ts"),
                await prettier.format(typeDefinitions, { parser: "typescript" })
            );

        } catch (error) {
            logger.error("Failed to generate action types:", error);
        }
    }

    /**
     * Groups actions by their import name for type generation
     */
    private groupActionsByImport(): Record<string, ActionMetadata[]> {
        return this.actions.reduce((acc, action) => {
            const filePath = action.file_path.replace(".ts", "");
            const importName = this.generateImportName(filePath);
            acc[importName] = acc[importName] || [];
            acc[importName].push(action);
            return acc;
        }, {} as Record<string, ActionMetadata[]>);
    }

    /**
     * Generates import name from file path
     */
    private generateImportName(filePath: string): string {
        return filePath.split("/")?.join("_")?.replace(".ts", "");
    }

    /**
     * Generates TypeScript type definitions for actions
     */
    private async generateActionTypes(groupedActions: Record<string, ActionMetadata[]>): Promise<string> {
        const imports = this.buildImportStatements(groupedActions);
        const actionResponseTypes = this.buildActionResponseTypes(groupedActions);
        const actionRequestTypes = this.buildActionRequestTypes(groupedActions);

        return `
        // imports
        import { z } from "bxo"
        ${imports}
        declare global {
            namespace Zodula {
            type ActionPath = keyof ActionResponse;
                interface ActionResponse {
                    ${actionResponseTypes}
                }

                interface ActionRequest {
                    ${actionRequestTypes}
                }
            }
        }

        export { };
        `;
    }

    /**
     * Builds import statements for action modules
     */
    private buildImportStatements(groupedActions: Record<string, ActionMetadata[]>): string {
        return Object.entries(groupedActions)
            .map(([importName, actions]) =>
                `import ${importName} from "../${actions[0]?.file_path}";`
            )
            .join("\n");
    }

    /**
     * Builds ActionResponse interface content
     */
    private buildActionResponseTypes(groupedActions: Record<string, ActionMetadata[]>): string {
        return Object.entries(groupedActions)
            .map(([importName, actions]) =>
                actions.map(action => this.buildActionResponseType(importName, action)).join("\n")
            )
            .join("\n");
    }

    /**
     * Builds ActionRequest interface content
     */
    private buildActionRequestTypes(groupedActions: Record<string, ActionMetadata[]>): string {
        return Object.entries(groupedActions)
            .map(([importName, actions]) =>
                actions.map(action => this.buildActionRequestType(importName, action)).join("\n")
            )
            .join("\n");
    }

    /**
     * Builds response type for a single action
     */
    private buildActionResponseType(importName: string, action: ActionMetadata): string {
        if (!action.config.response) {
            return `"${action.action_path}": any`;
        }
        return `"${action.action_path}": z.infer<typeof ${importName}.schema.response[200]>`;
    }

    /**
     * Builds request type for a single action
     */
    private buildActionRequestType(importName: string, action: ActionMetadata): string {
        if (!action.config.body) {
            return `"${action.action_path}": any`;
        }
        return `"${action.action_path}": z.infer<typeof ${importName}.schema.body>`;
    }
}