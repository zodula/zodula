import { Command } from "nailgun";
import { watch } from "fs";
import path from "path";
import { prepareApp, prepareTsxPage } from "@/zodula/server/prepare/tsxPage";

let proc: Bun.Subprocess | null = null
let debounceTimer: NodeJS.Timeout | null = null

const DEBOUNCE_DELAY = 300 // ms

function restartServer() {
    if (proc) {
        proc.kill()
    }

    proc = Bun.spawn({
        cmd: ["bun", "run", "apps/zodula/server/serve.tsx"],
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            NODE_ENV: "development",
        }
    })
}

function debouncedRestart() {
    if (debounceTimer) {
        clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
        console.log("🔄 File change detected, restarting server...")
        restartServer()
    }, DEBOUNCE_DELAY)
}

export default new Command("dev")
    .description("Start the development server")
    .action(async () => {
        await prepareApp()
        await prepareTsxPage()

        // Start the server initially
        restartServer()

        // Watch the apps folder for changes
        const appsPath = path.join(process.cwd(), "apps")
        console.log(`👀 Watching ${appsPath} for changes...`)

        watch(appsPath, { recursive: true }, (eventType, filename) => {
            if (filename && !filename.includes('node_modules') && !filename.includes('.git')) {
                debouncedRestart()
            }
        })

        // Watch for .zodula/.watch_trigger file (for migrate commands)
        const watchTriggerPath = path.join(process.cwd(), ".zodula", ".watch_trigger")

        // Ensure .zodula directory exists
        const zodulaDir = path.join(process.cwd(), ".zodula")
        try {
            await Bun.write(watchTriggerPath, "")
        } catch (error) {
            // Directory might not exist, create it
            await Bun.write(zodulaDir + "/.gitkeep", "")
            await Bun.write(watchTriggerPath, "")
        }

        watch(watchTriggerPath, (eventType) => {
            if (eventType === 'change') {
                console.log("🔄 Migration trigger detected, restarting server...")
                debouncedRestart()
            }
        })

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down development server...')
            if (proc) {
                proc.kill()
            }
            process.exit(0)
        })
    });