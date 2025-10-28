import type { BasePlugin } from "../base";
import { Glob } from "bun";
import path from "path";
import { loader } from "..";

export interface PortalMetadata {
    name: string;
    file: string;
    appName: string;
}

export class PortalLoader implements BasePlugin<PortalMetadata> {
    private portals: PortalMetadata[] = [];

    async load(): Promise<PortalMetadata[]> {
        this.portals = [];
        const portalGlob = new Glob("apps/*/portal/*/index.html");
        for await (const portal of portalGlob.scan(".")) {
            const app = loader.from("app").getAppByPath(portal);
            this.portals.push({
                name: path.dirname(portal).split("/").pop() || "",
                file: portal,
                appName: app?.packageName || "",
            });
        }
        return this.portals;
    }
    list(): PortalMetadata[] {
        return this.portals;
    }
    get(name: string): PortalMetadata {
        return this.portals.find((portal) => portal.name === name)!;
    }
    validate(): Promise<void> {
        return Promise.resolve();
    }
}