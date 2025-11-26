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

export class UiScriptLoader implements BasePlugin<UiScriptMetadata> {
    private scripts: UiScriptMetadata[] = [];

    async load(): Promise<UiScriptMetadata[]> {
        const scriptGlob = new Glob("apps/*/ui/scripts/**/*.ui.tsx");
        this.scripts = [];
        
        for await (const scriptPath of scriptGlob.scan(".")) {
            const app = loader.from("app").getAppByPath(scriptPath);
            const importName = scriptPath.replaceAll("/", "_").replaceAll(".", "___").replaceAll(":", "__").replaceAll("-", "_____");
            const importModule = await import(path.resolve(scriptPath));
            
            this.scripts.push({
                name: path.basename(scriptPath, ".tsx"),
                file: scriptPath,
                appName: app?.packageName || "",
                importPath: path.resolve(scriptPath),
                importName: `UI_SCRIPT_${importName}`,
                importModule: importModule,
                defaultExport: importModule.default
            });
        }
        
        return this.scripts;
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
