import { Glob } from "bun";
import path from "path";
import { LoaderHelper } from "../helper";
import { loader, type BasePlugin } from "..";
export interface FixturesMetadata {
    name: string;
    file: string;
    appName: string;
}

export interface FixturesPlugin extends BasePlugin<FixturesMetadata> {
    load(): Promise<FixturesMetadata[]>;
    list(): FixturesMetadata[];
    get(name: string): FixturesMetadata;
    validate(): Promise<void>;
}

export class FixturesLoader implements FixturesPlugin {
    private fixtures: FixturesMetadata[] = [];

    async load(): Promise<FixturesMetadata[]> {
        this.fixtures = [];
        const fixturesGlob = new Glob("apps/*/fixtures/*.fixture.json");
        for await (const fixture of fixturesGlob.scan(".")) {
            const fixtureJson = await import(path.resolve(fixture))
            const app = loader.from("app").getAppByPath(fixture)
            this.fixtures.push({
                name: path.basename(fixture).replace(".fixture.json", ""),
                file: fixture,
                appName: app?.packageName || "",
            })
        }
        return this.fixtures;
    }
    list(): FixturesMetadata[] {
        return this.fixtures;
    }
    get(name: string): FixturesMetadata {
        const fixture = this.fixtures.find((fixture) => fixture.name === name)
        if (!fixture) {
            throw new Error(`Fixture ${name} not found`);
        }
        return fixture
    }
    validate(): Promise<void> {
        if (this.fixtures.length !== new Set(this.fixtures.map((fixture) => fixture.name)).size) {
            throw new Error("Duplicate fixture names");
        }
        return Promise.resolve();
    }
}