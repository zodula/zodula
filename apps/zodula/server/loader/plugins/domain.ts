import { Glob } from "bun";
import path from "path";
import { LoaderHelper } from "../helper";
import fs from "fs/promises";
import { loader } from "..";

// Self-contained interfaces for this plugin
export interface DomainMetadata {
    name: string;
    dir: string;
    appName: string;
}

export interface DomainPlugin {
    load(): Promise<DomainMetadata[]>;
    list(): DomainMetadata[];
    get(name: string): DomainMetadata;
    validate(): Promise<void>;
}

const ignoreDomains = ["src", "node_modules", "dist", "build", "coverage", ".git"]

export class DomainLoader implements DomainPlugin {
    private domains: DomainMetadata[] = [];

    async load(): Promise<DomainMetadata[]> {
        // Scan for all app directories
        this.domains = [];
        const appfolders = await fs.readdir(path.resolve("apps"));
        for (const appPath of appfolders) {
            const appDir = appPath.replace(/\/$/, ""); // Remove trailing slash
            const appName = path.basename(appDir);

            // Get the app metadata to ensure it's a valid app
            const app = loader.from("app").getAppByPath(`apps/${appPath}/doctypes`);
            if (!app) {
                continue; // Skip if not a valid app
            }

            // Scan for domain folders in this app (excluding src and other non-domain folders)
            const domainfolders = await fs.readdir(path.resolve(`apps/${appPath}/doctypes`));
            for (const domainPath of domainfolders) {
                const domainDir = path.resolve(`apps/${appPath}/doctypes/${domainPath}`); // Remove trailing slash
                const domainName = path.basename(domainDir);

                // Skip src and other non-domain folders
                if (ignoreDomains.includes(domainName) ||
                    domainName.includes(".")) {
                    continue;
                }

                // Check if it's actually a directory (not a file)
                try {
                    const stat = await Bun.file(domainDir).stat();
                    if (!stat.isDirectory) {
                        continue;
                    }
                } catch (e) {
                    continue; // Skip if we can't stat the path
                }

                this.domains.push({
                    name: domainName,
                    dir: domainDir,
                    appName: app.packageName,
                });
            }
        }
        return this.domains;
    }

    list(): DomainMetadata[] {
        return this.domains;
    }

    get(name: string): DomainMetadata {
        const domain = this.domains.find((domain) => domain.name === name);
        if (!domain) {
            throw new Error(`Domain ${name} not found`);
        }
        return domain;
    }

    async validate(): Promise<void> {
        // Check for duplicate domain names within the same app
        const appDomains = new Map<string, Set<string>>();

        for (const domain of this.domains) {
            if (!appDomains.has(domain.appName)) {
                appDomains.set(domain.appName, new Set());
            }

            const domainSet = appDomains.get(domain.appName)!;
            if (domainSet.has(domain.name)) {
                throw new Error(`Duplicate domain name '${domain.name}' in app '${domain.appName}'`);
            }

            domainSet.add(domain.name);
        }
    }
}
