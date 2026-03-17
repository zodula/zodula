import { Command } from "nailgun";
import { watch, type FSWatcher } from "fs";
import path from "path";
import { startup } from "@/zodula/server/startup";

let proc: Bun.Subprocess | null = null
let debounceTimer: NodeJS.Timeout | null = null
let appsWatcher: FSWatcher | null = null
let triggerWatcher: FSWatcher | null = null
let signalsRegistered = false
let nextRestartNeedsStartup = false

const DEBOUNCE_DELAY = 100 // ms

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

function queueRestart(withStartup: boolean) {
    nextRestartNeedsStartup = nextRestartNeedsStartup || withStartup

    if (debounceTimer) {
        clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
        const doStartup = nextRestartNeedsStartup
        nextRestartNeedsStartup = false
        console.log("🔄 File change detected, restarting server...", doStartup ? "(with startup)" : "")
        if (doStartup) {
            await startup()
        }
        restartServer()
    }, DEBOUNCE_DELAY)
}

export default new Command("dev")
    .description("Start the development server")
    .action(async () => {
        await startup()

        restartServer()

        if (appsWatcher) {
            appsWatcher.close()
        }
        if (triggerWatcher) {
            triggerWatcher.close()
        }

        const appsPath = path.join(process.cwd(), "apps")
        console.log(`👀 Watching ${appsPath} for changes...`)

        appsWatcher = watch(appsPath, { recursive: true }, (eventType, filename) => {
            if (filename && !filename.includes('node_modules') && !filename.includes('.git') && !filename.includes('fixture.json')) {
                queueRestart(false)
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

        triggerWatcher = watch(watchTriggerPath, (eventType) => {
            if (eventType === 'change') {
                console.log("🔄 Migration trigger detected, restarting server with startup...")
                queueRestart(true)
            }
        })

        if (!signalsRegistered) {
            signalsRegistered = true

            const shutdown = () => {
                console.log('\n🛑 Shutting down development server...')
                if (proc) {
                    proc.kill()
                }
                if (appsWatcher) {
                    appsWatcher.close()
                    appsWatcher = null
                }
                if (triggerWatcher) {
                    triggerWatcher.close()
                    triggerWatcher = null
                }
                process.exit(0)
            }

            process.on('SIGTERM', shutdown)
            process.on('SIGINT', shutdown)
        }
    });