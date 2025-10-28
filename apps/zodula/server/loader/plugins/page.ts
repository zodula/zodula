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

    async load(): Promise<PageMetadata[]> {
        const portalGlob = new Glob("apps/*/ui/pages/**/page.tsx");
        this.pages = [];
        this.shell = [];
        for await (const pagePath of portalGlob.scan(".")) {
            const app = loader.from("app").getAppByPath(pagePath);
            const importName = pagePath.replaceAll("/", "_").replaceAll(".", "___").replaceAll(":", "__").replaceAll("-", "_____")
            const routerPathRegex = /apps\/(.*)\/ui\/pages\/(.*)\/page\.tsx/;
            const routerPath = "/" + (pagePath.match(routerPathRegex)?.[2] || "");
            const importModule = await import(path.resolve(pagePath))
            this.pages.push({
                name: path.dirname(pagePath).split("/").pop() || "",
                path: routerPath,
                file: pagePath,
                importPath: path.resolve(pagePath),
                appName: app?.packageName || "",
                importName: `PAGE_${importName}`,
                importModule: importModule,
                generateMetadata: importModule.generateMetadata
            });
        }
        const shellGlob = new Glob("apps/*/ui/pages/shell.tsx");
        for await (const shellPath of shellGlob.scan(".")) {
            const app = loader.from("app").getAppByPath(shellPath);
            const importName = shellPath.replaceAll("/", "_").replaceAll(".", "___").replaceAll(":", "__")
            const importModule = await import(path.resolve(shellPath))
            this.shell.push({
                name: "shell",
                path: "/shell",
                file: shellPath,
                appName: app?.packageName || "",
                importPath: path.resolve(shellPath),
                importName: `SHELL_${importName}`,
                importModule: importModule,
                generateMetadata: importModule.generateMetadata
            })
        }
        return this.pages;
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