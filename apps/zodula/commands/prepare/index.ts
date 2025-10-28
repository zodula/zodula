import path from "path";
import { Command } from "nailgun";
import { startup } from "@/zodula/server/startup";
import { loader } from "@/zodula/server/loader";

export default new Command("prepare")
    .description("Prepare the project")
    .action(async () => {
        await startup()
        // const apps = loader.from("app").list()
        // for (const app of apps) {
        //     const buildScriptImport = await import(path.resolve(app.dir, "scripts", "prepare")).catch(() => null);
        //     if (buildScriptImport) {
        //         await buildScriptImport.default();
        //     }
        // }
    });