import { Command } from "nailgun";
import { loader } from "@/zodula/server/loader";
import { startup } from "@/zodula/server/startup";
import prettier from "prettier";
import path from "path";
import { logger } from "@/zodula/server/logger";
import inquirer from "inquirer";

export default new Command("generate")
    .description("Generate blank migration files")
    .action(async () => {
        await startup()

        try {
            // use inquirer to choose app
            const result = await inquirer.prompt([
                {
                    type: "list",
                    name: "appPackageName",
                    message: "Choose app to generate blank migration",
                    choices: loader.from("app").list().map(app => {
                        return {
                            name: `${app.packageName} (${app.folder})`,
                            value: app.packageName
                        }
                    })
                }
            ])

            const app = loader.from("app").get(result.appPackageName)

            const migrationContent = `
export default $migration(async ({db}) => {

})
`
            const formatted = await prettier.format(migrationContent, { parser: "typescript" })
            const fileName = `${new Date().getTime()}_${app.packageName}_blank.ts`
            const filePath = path.join("apps", app.folder, "migrations", fileName)

            await Bun.write(filePath, formatted)
            logger.success(`Generated blank migration: ${filePath}`)
            process.exit(0)
        } catch (error) {
            logger.error("Failed to generate migration:", error)
            process.exit(1)
        }
    });