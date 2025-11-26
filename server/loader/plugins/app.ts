import { Glob } from "bun";
import path from "path";

// Self-contained interfaces for this plugin
export interface AppMetadata {
    packageName: string;
    package: any;
    dir: string;
    folder: string;
    idx: number;
}

export interface AppPlugin {
    load(): Promise<AppMetadata[]>;
    list(): AppMetadata[];
    get(name: string): AppMetadata;
    validate(): Promise<void>;
}

export class AppLoader implements AppPlugin {
    private apps: AppMetadata[] = [];

    getAppByPath(_path: string): AppMetadata | undefined {
        return this.apps.find((app) => path.resolve(_path).startsWith(path.resolve(app.dir)));
    }

    async load(): Promise<AppMetadata[]> {
        this.apps = [];
        const appGlob = new Glob("apps/*/package.json");
        for await (const app of appGlob.scan(".")) {
            const packageJson = await import(path.resolve(app));
            this.apps.push({
                packageName: packageJson.name,
                package: packageJson,
                dir: path.dirname(app),
                folder: path.dirname(app).split("/").pop() || "",
                idx: typeof packageJson.idx === "number" ? packageJson.idx : 999,
            });
        }
        this.apps.sort((a, b) => a.idx - b.idx);
        return this.apps;
    }

    list(): AppMetadata[] {
        return this.apps;
    }

    get(packageName: string): AppMetadata {
        const app = this.apps.find((app) => app.packageName === packageName);
        if (!app) {
            throw new Error(`App ${packageName} not found`);
        }
        return app;
    }

    async validate(): Promise<void> {
        if (this.apps.length !== new Set(this.apps.map((app) => app.packageName)).size) {
            throw new Error("Duplicate app names");
        }
    }
}
