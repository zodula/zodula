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
    async validate(): Promise<void> {
        const idMap = new Map<string, Array<{ fixture: FixturesMetadata; index: number }>>();
        
        // Load all fixture files and collect IDs
        for (const fixture of this.fixtures) {
            const fixtureData = await import(path.resolve(fixture.file)).catch(e => {
                throw new Error(`Failed to import fixture ${fixture.name}: ${e.message}`);
            });
            const fixtureArray = Array.isArray(fixtureData.default) ? fixtureData.default : fixtureData.default ? [fixtureData.default] : [];
            
            for (let i = 0; i < fixtureArray.length; i++) {
                const item = fixtureArray[i];
                if (item && typeof item === 'object' && 'id' in item) {
                    const id = String(item.id);
                    if (!idMap.has(id)) {
                        idMap.set(id, []);
                    }
                    idMap.get(id)!.push({ fixture, index: i });
                }
            }
        }
        
        // Find duplicate IDs
        const duplicates: Array<{ id: string; locations: Array<{ fixture: FixturesMetadata; index: number }> }> = [];
        for (const [id, locations] of idMap.entries()) {
            if (locations.length > 1) {
                duplicates.push({ id, locations });
            }
        }
        
        if (duplicates.length > 0) {
            const duplicateMessages = duplicates.map(({ id, locations }) => {
                const locationDetails = locations.map(loc => 
                    `  - ${loc.fixture.file} (app: ${loc.fixture.appName}, index: ${loc.index})`
                ).join('\n');
                return `ID "${id}" appears ${locations.length} times:\n${locationDetails}`;
            });
            
            throw new Error(`Duplicate fixture IDs found:\n${duplicateMessages.join('\n\n')}`);
        }
    }
}