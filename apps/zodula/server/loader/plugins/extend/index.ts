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

export class ExtendLoader implements BasePlugin<ExtendMetadata> {
    private extends: ExtendMetadata[] = []

    $extend = (handler: (e: handlerProps) => void) => {
        return {
            handler
        }
    }

    async load() {
        this.extends = [];
        const extendGlob = new Glob("apps/*/scripts/**/*.extend.ts");
        
        for await (const extendPath of extendGlob.scan(".")) {
            const app = loader.from("app").getAppByPath(extendPath);
            if (!app) {
                continue;
            }
            
            const extendImport = await import(path.resolve(extendPath)).catch((e) => null);
            if (!extendImport) {
                continue;
            }
            
            const extendDefault = extendImport.default;
            if (!extendDefault || !extendDefault.handler) {
                continue;
            }
            
            this.extends.push({
                appName: app.packageName,
                handler: extendDefault.handler
            });
        }
        
        return this.extends;
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


