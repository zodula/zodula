import type { BasePlugin } from "../base";
import { Glob } from "bun";
import path from "path";
import { loader } from "..";

export interface UiScriptMetadata {
    name: string;
    file: string;
    appName: string;
    importPath: string;
    importName: string;
    importModule: any;
    defaultExport: any;
}

const replaceSpecialCharacters = (path: string) => {
    return path.replaceAll("/", "_").replaceAll(".", "___").replaceAll(":", "__").replaceAll("-", "_____").replaceAll(" ", "________");
}       

export class UiScriptLoader implements BasePlugin<UiScriptMetadata> {
    private scripts: UiScriptMetadata[] = [];

    /**
     * Loads UI script definitions from the filesystem.
     *
     * @param filePath  When provided, performs a scoped HMR reload of only that
     *                  file with cache busting.
     *                  When omitted, clears all scripts and does a full scan.
     */
    async load(filePath?: string): Promise<UiScriptMetadata[]> {
        if (filePath) {
            await this.loadSingleScript(filePath, true);
            return this.scripts;
        }

        // Full reload — reset first to prevent duplicates
        this.scripts = [];
        const scriptGlob = new Glob("apps/*/ui/scripts/**/*.ui.tsx");
        const doctypeScriptGlob = new Glob("apps/*/doctypes/*/*/*.ui.tsx");

        for await (const scriptPath of scriptGlob.scan(".")) {
            await this.loadSingleScript(scriptPath, false);
        }
        for await (const scriptPath of doctypeScriptGlob.scan(".")) {
            await this.loadSingleScript(scriptPath, false);
        }

        return this.scripts;
    }

    /** Load (or hot-reload) a single .ui.tsx file. */
    private async loadSingleScript(scriptPath: string, bust: boolean): Promise<void> {
        const resolvedPath = path.resolve(scriptPath);
        // Remove stale entry
        this.scripts = this.scripts.filter(s => s.importPath !== resolvedPath);

        const app = loader.from("app").getAppByPath(scriptPath);
        const importName = replaceSpecialCharacters(scriptPath);
        const specifier = bust ? `${resolvedPath}?t=${Date.now()}` : resolvedPath;
        const importModule = await import(specifier);

        if (!importModule.default) return;

        this.scripts.push({
            name: path.basename(scriptPath, ".tsx"),
            file: scriptPath,
            appName: app?.packageName || "",
            importPath: resolvedPath,
            importName: `UI_SCRIPT_${importName}`,
            importModule,
            defaultExport: importModule.default
        });
    }

    list(): UiScriptMetadata[] {
        return this.scripts;
    }

    get(name: string): UiScriptMetadata {
        return this.scripts.find((script) => script.name === name)!;
    }

    validate(): Promise<void> {
        return Promise.resolve();
    }
}
