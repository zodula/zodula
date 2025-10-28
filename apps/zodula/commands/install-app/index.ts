import { Command } from "nailgun";
import { loader } from "../../server/loader";
import { $ } from "bun";
import { logger } from "../../server/logger";
import { startup } from "../../server/startup";

export default new Command("install-app")
    .description("Install an app")
    .argument("<app>", "The app to install")
    .option("-b, --branch <branch>", "The branch to install")
    .option("-f, --force", "Force install even if the app already exists")
    .action(async (app, options) => {
        await startup()
        if (!app) {
            throw "App is required"
        }
        const [_username, appName] = app?.split("/") || []
        if (!_username?.startsWith?.("@")) {
            throw "Username must start with @"
        }
        const username = _username.slice(1)
        if (!appName) {
            throw "App name is required"
        }
        if (!username) {
            throw "Username is required"
        }

        const branch = options?.branch || "master"
        const remoteAppPackageUrl = `https://raw.githubusercontent.com/${username}/${appName}/refs/heads/${branch || "main"}/package.json`
        logger.info(`Fetching package.json from ${remoteAppPackageUrl}`)
        const remoteAppPackage = await fetch(remoteAppPackageUrl)
        const remoteAppPackageJson = await remoteAppPackage.json()
        const remoteAppPackageName = remoteAppPackageJson.name
        // check if there are any apps with the same name
        const apps = loader.from("app").list()
        const appExists = apps.find((a) => a.packageName === remoteAppPackageName)
        if (appExists && !options?.force) {
            throw `App ${remoteAppPackageName} already exists`
        }
        if (appExists && options?.force) {
            await $`rm -rf apps/${remoteAppPackageName}`
            // remove node_modules
            await $`rm -rf node_modules`
            // remove bun.lockb
            await $`rm -rf bun.lock`
        }

        // clone the app
        await $.cwd("apps")`git clone https://github.com/${username}/${appName}.git ${branch ? `-b ${branch}` : ""}`

        // bun install from root
        await $`bun install`

    })