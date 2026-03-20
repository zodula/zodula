// Generic plugin interface - any plugin must implement this
export interface BasePlugin<T = any> {
    /**
     * Load all entries, or a single file for scoped HMR.
     * @param filePath  When provided, only reload that specific file (cache-busted).
     *                  When omitted, perform a full scan and reload.
     */
    load(filePath?: string): Promise<T[]>;
    list(): T[];
    get(name: string): T;
    validate(): Promise<void>;
    /**
     * Apply predefined DB metadata for this plugin's entries.
     * Optional — only plugins that manage persisted metadata implement this.
     * @param filePath  When provided, scope the sync to a single entry.
     *                  When omitted, sync all entries managed by this plugin.
     */
    applyPredefined?(filePath?: string): Promise<void>;
}

// Generic plugin map type for dynamic registration
export type PluginMap = Map<string, BasePlugin<any>>;

// Main Loader class with generic plugin system
export class Loader<T extends Record<string, BasePlugin<any>> = {}> {
    private plugins: PluginMap = new Map();

    register<K extends string, P extends BasePlugin<any>>(type: K, plugin: P): Loader<T & Record<K, P>> {
        this.plugins.set(type, plugin);
        return this as unknown as Loader<T & Record<K, P>>;
    }

    from<K extends keyof T>(type: K): T[K] {
        const plugin = this.plugins.get(type as string);
        if (!plugin) {
            throw new Error(`Plugin ${String(type)} not registered`);
        }
        return plugin as T[K];
    }

    // Generic access for dynamic plugins
    getPlugin<P extends BasePlugin<any>>(type: string): P {
        const plugin = this.plugins.get(type);
        if (!plugin) {
            throw new Error(`Plugin ${type} not registered`);
        }
        return plugin as P;
    }

    /**
     * Load plugins.
     *
     * @param type      When provided, reload only this plugin type.
     * @param filePath  When provided alongside `type`, reload only that specific
     *                  file within the plugin (HMR single-file reload).
     *
     * Performance: when doing a full load (no `type`), the "app" plugin is loaded
     * first (others depend on it), then all remaining plugins are loaded in parallel.
     */
    async load(type?: string, filePath?: string): Promise<this> {
        if (type) {
            const plugin = this.plugins.get(type);
            if (!plugin) throw new Error(`Plugin ${type} not registered`);
            await plugin.load(filePath);
        } else {
            // Loading happens in two sequential waves to respect dependencies:
            //
            // Wave 1 — foundational (others may call loader.from() at import time)
            //   app     : everything else calls getAppByPath() during its own load
            //   doctype : actions/extends can call loader.from("doctype").get() at
            //             module level, so doctypes must be fully populated first
            //
            // Wave 2 — all remaining plugins in parallel (fast)
            const wave1 = ["app", "doctype"];
            for (const key of wave1) {
                const plugin = this.plugins.get(key);
                if (plugin) await plugin.load();
            }

            const wave2 = Array.from(this.plugins.entries())
                .filter(([key]) => !wave1.includes(key))
                .map(([, plugin]) => plugin.load());
            await Promise.all(wave2);
        }
        return this;
    }

    /**
     * Validate plugins.
     *
     * @param type  When provided, validate only this plugin type.
     *              When omitted, validate all plugins in parallel.
     */
    async validate(type?: string): Promise<this> {
        if (type) {
            const plugin = this.plugins.get(type);
            if (!plugin) throw new Error(`Plugin ${type} not registered`);
            await plugin.validate();
        } else {
            await Promise.all(
                Array.from(this.plugins.values()).map(plugin => plugin.validate())
            );
        }
        return this;
    }

    /**
     * Apply predefined DB metadata, optionally scoped to one plugin type and/or file.
     *
     * @param type      When provided, apply only for this plugin type.
     *                  When omitted, apply for every plugin that implements `applyPredefined`.
     * @param filePath  When provided alongside `type`, scope to a single file/entry (HMR).
     *                  When omitted, apply for all entries owned by the plugin(s).
     */
    async applyPredefined(type?: string, filePath?: string): Promise<this> {
        if (type) {
            const plugin = this.plugins.get(type) as BasePlugin<any>;
            if (!plugin) throw new Error(`Plugin ${type} not registered`);
            if (typeof plugin.applyPredefined === "function") {
                await plugin.applyPredefined(filePath);
            }
        } else {
            await Promise.all(
                Array.from(this.plugins.values())
                    .filter(plugin => typeof plugin.applyPredefined === "function")
                    .map(plugin => plugin.applyPredefined!())
            );
        }
        return this;
    }

    // Get all registered plugin types
    getPluginTypes(): string[] {
        return Array.from(this.plugins.keys());
    }

    // Check if a plugin type is registered
    hasPlugin(type: string): boolean {
        return this.plugins.has(type);
    }

}
