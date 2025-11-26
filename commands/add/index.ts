import { Command } from "nailgun";
import { $ } from "bun";
import path from "path";
import { loader } from "@/zodula/server/loader";
import inquirer from "inquirer";
import { startup } from "@/zodula/server/startup";

export default new Command("add")
    .description("Add dependencies to a specific app")
    .argument("<packages...>", "Package names to install")
    .option("-a, --app <app>", "App name (e.g., zodula, onlyagents)")
    .option("-D, --dev", "Install as dev dependency")
    .option("-P, --peer", "Install as peer dependency")
    .option("-f, --force", "Force install dependencies")
    .action(async (packages, options) => {
        await startup()
        // Get all available apps
        const apps = loader.from("app").list();
        let targetApp;

        if (options.app) {
            targetApp = apps.find(a => a.packageName === options.app);
            if (!targetApp) {
                console.error(`❌ App "${options.app}" not found. Available apps: ${apps.map(a => a.packageName).join(", ")}`);
                process.exit(1);
            }
        } else {
            // Use inquirer to let user select an app
            const { selectedApp } = await inquirer.prompt([
                {
                    type: "list",
                    name: "selectedApp",
                    message: "Select an app to add dependencies to:",
                    choices: apps.map(app => ({
                        name: `${app.packageName} (${app.dir})`,
                        value: app
                    }))
                }
            ]);
            targetApp = selectedApp;
        }

        console.log(`📦 Adding dependencies to ${targetApp.packageName}...`);

        // Change to the app directory
        const appDir = targetApp.dir;

        try {
            // Build the bun add command
            const args = ["add"];

            if (options.dev) {
                args.push("-D");
            }
            if (options.peer) {
                args.push("-P");
            }
            if (options.force) {
                args.push("--force");
            }

            args.push(...packages);

            console.log(`Running: bun ${args.join(" ")} in ${appDir}`);

            // Run the command in the app directory
            const result = await $`bun ${args}`.cwd(appDir);

            if (result.exitCode === 0) {
                console.log(`✅ Successfully added ${packages.join(", ")} to ${targetApp.packageName}`);
                process.exit(0);
            } else {
                console.error(`❌ Failed to add dependencies to ${targetApp.packageName}`);
                process.exit(1);
            }
        } catch (error) {
            console.error(`❌ Error adding dependencies to ${targetApp.packageName}:`, error);
            process.exit(1);
        }
    });
