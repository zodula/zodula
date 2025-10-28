import { type BasePlugin } from "../base"
import { loader } from ".."
import path from "path"
import type BXO from "bxo"
import { events, type DoctypeEvent, type DoctypeEventCallback, type DoctypeEventCallbackByName } from "./doctype"

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
        const apps = loader.from("app").list()
        for (const app of apps) {
            const extendImport = await import(path.resolve(app.dir, "extend")).catch((e) => null)
            if (!extendImport) {
                continue
            }
            const extendDefault = extendImport.default
            const extendHandler = extendDefault.handler
            this.extends.push({
                appName: app.packageName,
                handler: extendHandler
            })
        }
        return this.extends
    }
    list(): any[] {
        return this.extends
    }
    get(name: string): any {
        return this.extends.find((e) => e.appName === name)
    }
    validate() {
        if (this.extends.length !== new Set(this.extends.map((e) => e.appName)).size) {
            throw new Error("Duplicate extend names");
        }
        return Promise.resolve();
    }
}


