// Re-export types and classes
export type {
    BasePlugin,
    PluginMap
} from "./base";

export {
    Loader
} from "./base";

// Create and export the default loader instance with auto-detected types
import { Loader } from "./base";
import { AppLoader } from "./plugins/app";
import { DomainLoader } from "./plugins/domain";
import { DoctypeLoader } from "./plugins/doctype";
import { FixturesLoader } from "./plugins/fixtures";
import { PortalLoader } from "./plugins/portal";
import { PageLoader } from "./plugins/page";
import { ExtendLoader } from "./plugins/extend";
import { ActionLoader } from "./plugins/action";
import { BackgroundLoader } from "./plugins/background";
import { UiScriptLoader } from "./plugins/ui-script";
// import { AppLoader, DoctypeLoader, DomainLoader, FixturesLoader, PortalLoader, PageLoader, ExtendLoader, ActionLoader } from "./plugins";

export const loader = new Loader()
    .register("app", new AppLoader())
    .register("domain", new DomainLoader())
    .register("doctype", new DoctypeLoader())
    .register("fixture", new FixturesLoader())
    .register("portal", new PortalLoader())
    .register("page", new PageLoader())
    .register("extend", new ExtendLoader())
    .register("action", new ActionLoader())
    .register("background", new BackgroundLoader())
    .register("ui-script", new UiScriptLoader())


export const $doctype = loader.from("doctype").$doctype;
export const $extend = loader.from("extend").$extend;
export const $action = loader.from("action").$action;
export const $background = loader.from("background").$background;