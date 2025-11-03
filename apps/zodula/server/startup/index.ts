/// <reference path="./doctype.d.ts" />
import prepareScript from "@/zodula/server/prepare";
import { loader } from "@/zodula/server/loader";
import { migrationHandler } from "@/zodula/server/handler/migration";
import { zodula } from "@/zodula/server/zodula";
import { Fields } from "../field/field";

global.$migration = migrationHandler;
global.$zodula = zodula;
global.$loader = loader;
global.$doctype = loader.from("doctype").$doctype;
global.$extend = loader.from("extend").$extend;
global.$f = Fields;
global.$action = loader.from("action").$action;
global.$background = loader.from("background").$background;

export async function startup() {
    await loader.load()
    await loader.validate()
    await prepareScript()
}