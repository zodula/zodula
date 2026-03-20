import { type BasePlugin } from "../../base"
import { loader } from "../.."
import path from "path"
import { Glob } from "bun"
import type BXO from "bxo"
import { events, type DoctypeEvent, type DoctypeEventCallback, type DoctypeEventCallbackByName } from "../doctype"

const DEBUG = process.env.DEBUG === "true"

interface handlerProps {
    bxo: BXO
    on: <DN extends Zodula.DoctypeName>(doctypeName: DN, event: DoctypeEvent, callback: DoctypeEventCallbackByName<DN>) => void
    property: <DN extends Zodula.DoctypeName, FN extends keyof Zodula.SelectDoctype<DN>, PN extends keyof Zodula.Field<Zodula.FieldType, 0 | 1>>(doctypeName: DN, fieldname: FN, propertyName: PN, value: Zodula.Field[PN]) => void
}

export interface ExtendMetadata {
    appName: string
    handler: (e: handlerProps) => void
}

export const on = <DN extends Zodula.DoctypeName>(doctypeName: DN, event: DoctypeEvent, callback: DoctypeEventCallbackByName<DN>) => {
    const _events = events.get(doctypeName) || new Map<DoctypeEvent, DoctypeEventCallbackByName<DN>[]>()
    const _e2 = _events.get(event) || []
    _e2.push(callback as any)
    _events.set(event, _e2 as any)
    events.set(doctypeName, _events as any)
    return {
        doctypeName,
        event,
        callback
    }
}

export const property = <DN extends Zodula.DoctypeName, FN extends keyof Zodula.SelectDoctype<DN>, PN extends keyof Zodula.Field<Zodula.FieldType, 0 | 1>>(doctypeName: DN, fieldname: FN, propertyName: PN, value: Zodula.Field[PN]) => {
    loader.from("doctype").setProperty(doctypeName, fieldname as any, propertyName as any, value as any);
}

export class ExtendLoader implements BasePlugin<ExtendMetadata> {
    private extends: ExtendMetadata[] = []

    $extend = (handler: (e: handlerProps) => void) => {
        return {
            handler
        }
    }

    /**
     * Loads extend handlers from the filesystem.
     *
     * @param filePath  When provided, performs a scoped HMR reload of only that
     *                  file: removes the old entry and re-imports with cache busting.
     *                  When omitted, clears all handlers and does a full scan.
     */
    async load(filePath?: string) {
        if (filePath) {
            // Scoped HMR: drop the old entry and re-import the changed file
            this.extends = this.extends.filter(
                e => !filePath.endsWith(`${e.appName}/scripts`)
            );
            await this.loadExtendFromFile(filePath, true);
        } else {
            this.extends = [];
            const extendGlob = new Glob("apps/*/scripts/**/*.extend.ts");
            for await (const extendPath of extendGlob.scan(".")) {
                await this.loadExtendFromFile(extendPath, false);
            }
        }

        return this.extends;
    }

    /**
     * Loads a single extend handler file.
     * @param bust  When true the module cache is bypassed (used during HMR).
     */
    private async loadExtendFromFile(extendPath: string, bust: boolean): Promise<void> {
        const app = loader.from("app").getAppByPath(extendPath);
        if (!app) return;

        try {
            const resolved = path.resolve(extendPath);
            const specifier = bust ? `${resolved}?t=${Date.now()}` : resolved;
            const extendImport = await import(specifier);
            const extendDefault = extendImport?.default;
            if (!extendDefault?.handler) return;

            this.extends.push({
                appName: app.packageName,
                handler: extendDefault.handler
            });
        } catch {
            // silently skip files that fail to import
        }
    }
    list(): any[] {
        return this.extends
    }
    get(name: string): any {
        return this.extends.find((e) => e.appName === name)
    }
    validate() {
        // Multiple extends per app are now allowed
        return Promise.resolve();
    }
}


