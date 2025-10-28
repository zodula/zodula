import { migrationHandler } from "@/zodula/server/handler/migration";
import { zodula } from "@/zodula/server/zodula";
import { loader } from "../loader";
import { $doctype as $doctypeClass } from "../loader";
import { $extend as $extendClass } from "../loader";
import { Fields } from "../field/field";
import { $action as $actionClass } from "../loader";
import { $background as $backgroundClass } from "../loader";
import type { BackgroundHandler } from "../loader/plugins/background";


declare global {
    var $migration: typeof migrationHandler;
    var $zodula: typeof zodula;
    var $loader: typeof loader;
    var $doctype: typeof $doctypeClass;
    var $extend: typeof $extendClass;
    /**
     * @deprecated Use plain field object instead
     */
    var $f: typeof Fields;
    var $action: typeof $actionClass;
    var $background: typeof $backgroundClass;
    namespace Zodula {

    }
}

export { };
