import type { BasePlugin } from "../base";
import { Glob } from "bun";
import path from "path";
import { loader } from "..";
import type { Context } from "bxo";
import type { Metadata } from "@/zodula/ui";

export interface PageMetadata {
    name: string;
    path: string;
    file: string;
    appName: string;
    importPath: string;
    importName: string;
    importModule: any;
    generateMetadata: (ctx: Context) => Promise<Metadata>;
}

export interface ShellMetadata {
    name: string;
    path: string;
    file: string;
    appName: string;
    importPath: string;
    importName: string;
    importModule: any;
    generateMetadata: (ctx: Context) => Promise<Metadata>;
}

export class PageLoader implements BasePlugin<PageMetadata> {
    private pages: PageMetadata[] = [];
    private shell: ShellMetadata[] = [];

    /**
     * Loads page definitions from the filesystem.
     *
     * @param filePath  When provided, performs a scoped HMR reload of only that
     *                  page/shell file with cache busting.
     *                  When omitted, clears all pages and does a full scan.
     */
    async load(filePath?: string): Promise<PageMetadata[]> {
        if (filePath) {
            await this.loadSinglePage(filePath, true);
            return this.pages;
        }

        // Full reload
        this.pages = [];
        this.shell = [];
        const portalGlob = new Glob("apps/*/ui/pages/**/page.tsx");
        for await (const pagePath of portalGlob.scan(".")) {
            await this.loadSinglePage(pagePath, false);
        }
        const shellGlob = new Glob("apps/*/ui/pages/shell.tsx");
        for await (const shellPath of shellGlob.scan(".")) {
            await this.loadSingleShell(shellPath, false);
        }
        return this.pages;
    }

    /** Load (or hot-reload) a single page.tsx file. */
    private async loadSinglePage(pagePath: string, bust: boolean): Promise<void> {
        const resolvedPath = path.resolve(pagePath);
        // Remove stale entry
        this.pages = this.pages.filter(p => p.importPath !== resolvedPath);

        const app = loader.from("app").getAppByPath(pagePath);
        const importName = pagePath.replaceAll("/", "_").replaceAll(".", "___").replaceAll(":", "__").replaceAll("-", "_____").replaceAll(" ", "_");
        const routerPathRegex = /apps\/(.*)\/ui\/pages\/(.*)\/page\.tsx/;
        const routerPath = "/" + (pagePath.match(routerPathRegex)?.[2] || "");
        const specifier = bust ? `${resolvedPath}?t=${Date.now()}` : resolvedPath;
        const importModule = await import(specifier);
        this.pages.push({
            name: path.dirname(pagePath).split("/").pop() || "",
            path: routerPath,
            file: pagePath,
            importPath: resolvedPath,
            appName: app?.packageName || "",
            importName: `PAGE_${importName}`,
            importModule,
            generateMetadata: importModule.generateMetadata
        });
    }

    /** Load (or hot-reload) a single shell.tsx file. */
    private async loadSingleShell(shellPath: string, bust: boolean): Promise<void> {
        const resolvedPath = path.resolve(shellPath);
        this.shell = this.shell.filter(s => s.importPath !== resolvedPath);

        const app = loader.from("app").getAppByPath(shellPath);
        const importName = shellPath.replaceAll("/", "_").replaceAll(".", "___").replaceAll(":", "__");
        const specifier = bust ? `${resolvedPath}?t=${Date.now()}` : resolvedPath;
        const importModule = await import(specifier);
        this.shell.push({
            name: "shell",
            path: "/shell",
            file: shellPath,
            appName: app?.packageName || "",
            importPath: resolvedPath,
            importName: `SHELL_${importName}`,
            importModule,
            generateMetadata: importModule.generateMetadata
        });
    }
    getShell(): ShellMetadata[] {
        return this.shell;
    }
    list(): PageMetadata[] {
        return this.pages;
    }
    get(name: string): PageMetadata {
        return this.pages.find((page) => page.name === name)!;
    }
    validate(): Promise<void> {
        return Promise.resolve();
    }
}