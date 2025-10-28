// Generic plugin interface - any plugin must implement this
export interface BasePlugin<T = any> {
    load(): Promise<T[]>;
    list(): T[];
    get(name: string): T;
    validate(): Promise<void>;
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

    async load(): Promise<this> {
        for (const [type, plugin] of this.plugins) {
            await plugin.load();
        }
        return this;
    }

    async validate(): Promise<this> {
        for (const [type, plugin] of this.plugins) {
            await plugin.validate();
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
