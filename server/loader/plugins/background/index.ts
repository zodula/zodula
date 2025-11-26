import { Glob } from "bun"
import { Loader, type BasePlugin } from "../../base"
import path from "path"
import { loader } from "../..";
import { logger } from "../../../logger";
import { z } from "bxo";
import prettier from "prettier";

/**
 * Metadata for a loaded background function
 */
export interface BackgroundMetadata {
    /** Path to the background function file */
    file_path: string
    /** Name of the function in the file */
    function_name: string
    /** Full background path (app.module.function) */
    background_path: string
    /** Name of the app this background function belongs to */
    app_name: string
    /** The background function handler */
    handler: any
    /** Background function schema configuration */
    config: {
        request?: z.ZodSchema
        response?: z.ZodSchema
    }
}

/**
 * Loader class for background function definitions
 * 
 * Handles loading, processing, and validation of background function definitions.
 * Generates TypeScript type definitions for background function requests and responses.
 */
export class BackgroundLoader implements BasePlugin<BackgroundMetadata> {
    /** Internal storage for loaded background functions */
    private backgrounds: BackgroundMetadata[] = [];

    $background = <TRequest = any, TResponse = any>(
        handler: (data: TRequest) => Promise<TResponse>,
    ) => {
        return {
            handler: handler,
            _type: {
                request: "request",
                response: "response"
            } as unknown as {
                request: z.ZodSchema<TRequest>
                response: z.ZodSchema<TResponse>
            }
        }
    }

    /**
     * Loads all background function definitions from the filesystem
     * 
     * Scans for .ts files in apps background directories and processes them.
     * Extracts background function handlers and their configurations.
     * 
     * @returns Promise resolving to array of loaded background function metadata
     */
    async load() {
        const backgroundGlob = new Glob("apps/*/background/**/*.ts");

        for await (const backgroundPath of backgroundGlob.scan(".")) {
            await this.loadBackgroundsFromFile(backgroundPath);
        }

        return this.backgrounds;
    }

    /**
     * Loads background functions from a single file
     */
    private async loadBackgroundsFromFile(backgroundPath: string): Promise<void> {
        try {
            const backgroundImport = await this.importBackgroundFile(backgroundPath);
            if (!backgroundImport || !backgroundImport.default) return;

            const app = this.getAppFromPath(backgroundPath);
            const moduleName = this.getModuleName(backgroundPath);

            const backgroundMetadata = this.createBackgroundMetadata(
                backgroundPath,
                "default",
                backgroundImport.default,
                app,
                moduleName
            );

            if (backgroundMetadata) {
                this.backgrounds.push(backgroundMetadata);
            }
        } catch (error) {
            logger.error(`Failed to load background functions from ${backgroundPath}:`, error);
        }
    }

    /**
     * Imports a background function file with error handling
     */
    private async importBackgroundFile(backgroundPath: string): Promise<any | null> {
        try {
            return await import(path.resolve(backgroundPath));
        } catch (error) {
            logger.error(`Failed to import background function file ${backgroundPath}:`, error);
            return null;
        }
    }

    /**
     * Gets app information from file path
     */
    private getAppFromPath(backgroundPath: string): any {
        return loader.from("app").getAppByPath(backgroundPath);
    }

    /**
     * Gets module name from file path
     */
    private getModuleName(backgroundPath: string): string {
        // Extract the path after 'background/' and before the filename
        const backgroundIndex = backgroundPath.indexOf('/background/');
        if (backgroundIndex === -1) {
            return path.basename(backgroundPath).replace(".ts", "");
        }
        
        const afterBackground = backgroundPath.substring(backgroundIndex + '/background/'.length);
        const withoutExtension = afterBackground.replace('.ts', '');
        return withoutExtension.replace(/\//g, '.');
    }

    /**
     * Creates background function metadata from function definition
     */
    private createBackgroundMetadata(
        filePath: string,
        functionName: string,
        functionDef: any,
        app: any,
        moduleName: string
    ): BackgroundMetadata | null {
        const handler = functionDef?.handler;
        if (!handler) return null;

        const backgroundPath = `${app?.packageName}.${moduleName}`;

        return {
            file_path: filePath,
            function_name: functionName,
            background_path: backgroundPath,
            app_name: app?.packageName || "",
            handler: handler,
            config: functionDef?._type || {}
        };
    }

    /**
     * Gets all loaded background functions
     * 
     * @returns Array of background function metadata
     */
    list(): BackgroundMetadata[] {
        return this.backgrounds;
    }

    /**
     * Gets a specific background function by path
     * 
     * @param name - The background function path to retrieve
     * @returns The background function metadata
     * @throws Error if background function not found
     */
    get(name: string): BackgroundMetadata {
        const background = this.backgrounds.find((background) => background.background_path === name);
        if (!background) {
            throw new Error(`Background function ${name} not found`);
        }
        return background;
    }

    /**
     * Validates all loaded background functions and generates type definitions
     * 
     * Generates TypeScript type definitions for background function requests and responses
     * based on the loaded background function configurations.
     */
    async validate() {
        try {
            const groupedBackgrounds = this.groupBackgroundsByImport();
            const typeDefinitions = await this.generateBackgroundTypes(groupedBackgrounds);

            await Bun.write(
                path.join(".zodula", "background.d.ts"),
                await prettier.format(typeDefinitions, { parser: "typescript" })
            );

        } catch (error) {
            logger.error("Failed to generate background function types:", error);
        }
    }

    /**
     * Groups background functions by their import name for type generation
     */
    private groupBackgroundsByImport(): Record<string, BackgroundMetadata[]> {
        return this.backgrounds.reduce((acc, background) => {
            const filePath = background.file_path.replace(".ts", "").replaceAll("-", "__");
            const importName = this.generateImportName(filePath);
            acc[importName] = acc[importName] || [];
            acc[importName].push(background);
            return acc;
        }, {} as Record<string, BackgroundMetadata[]>);
    }

    /**
     * Generates import name from file path
     */
    private generateImportName(filePath: string): string {
        return filePath.split("/")?.join("_")?.replace(".ts", "");
    }

    /**
     * Generates TypeScript type definitions for background functions
     */
    private async generateBackgroundTypes(groupedBackgrounds: Record<string, BackgroundMetadata[]>): Promise<string> {
        const imports = this.buildImportStatements(groupedBackgrounds);
        const backgroundResponseTypes = this.buildBackgroundResponseTypes(groupedBackgrounds);
        const backgroundRequestTypes = this.buildBackgroundRequestTypes(groupedBackgrounds);

        return `
        // imports
        import { z } from "bxo"
        ${imports}
        declare global {
            namespace Zodula {
                type BackgroundPath = keyof BackgroundResponse;
                interface BackgroundResponse {
                    ${backgroundResponseTypes}
                }

                interface BackgroundRequest {
                    ${backgroundRequestTypes}
                }
            }
        }

        export { };
        `;
    }

    /**
     * Builds import statements for background function modules
     */
    private buildImportStatements(groupedBackgrounds: Record<string, BackgroundMetadata[]>): string {
        return Object.entries(groupedBackgrounds)
            .map(([importName, backgrounds]) =>
                `import ${importName} from "../${backgrounds[0]?.file_path}";`
            )
            .join("\n");
    }

    /**
     * Builds BackgroundResponse interface content
     */
    private buildBackgroundResponseTypes(groupedBackgrounds: Record<string, BackgroundMetadata[]>): string {
        return Object.entries(groupedBackgrounds)
            .map(([importName, backgrounds]) =>
                backgrounds.map(background => this.buildBackgroundResponseType(importName, background)).join("\n")
            )
            .join("\n");
    }

    /**
     * Builds BackgroundRequest interface content
     */
    private buildBackgroundRequestTypes(groupedBackgrounds: Record<string, BackgroundMetadata[]>): string {
        return Object.entries(groupedBackgrounds)
            .map(([importName, backgrounds]) =>
                backgrounds.map(background => this.buildBackgroundRequestType(importName, background)).join("\n")
            )
            .join("\n");
    }

    /**
     * Builds response type for a single background function
     */
    private buildBackgroundResponseType(importName: string, background: BackgroundMetadata): string {
        if (!background.config.response) {
            return `"${background.background_path}": any`;
        }
        return `"${background.background_path}": z.infer<typeof ${importName}._type.response>`;
    }

    /**
     * Builds request type for a single background function
     */
    private buildBackgroundRequestType(importName: string, background: BackgroundMetadata): string {
        if (!background.config.request) {
            return `"${background.background_path}": any`;
        }
        return `"${background.background_path}": z.infer<typeof ${importName}._type.request>`;
    }
}
