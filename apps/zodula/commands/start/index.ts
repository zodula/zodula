import { Command } from "nailgun";
import { startup } from "@/zodula/server/startup";
import { watch } from "fs";
import path from "path";

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
        console.log("🔄 Migration trigger detected, restarting server...")
        restartServer()
    }, DEBOUNCE_DELAY)
}

export default new Command("start")
    .description("Start the development server")
    .action(async () => {
        await startup()
        
        // Start the server initially
        restartServer()
        
        // Watch for .zodula/.watch_trigger file (for migrate commands)
        const watchTriggerPath = path.join(process.cwd(), ".zodula", ".watch_trigger")
        console.log(`👀 Watching ${watchTriggerPath} for migration triggers...`)
        
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
                debouncedRestart()
            }
        })
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down server...')
            if (proc) {
                proc.kill()
            }
            process.exit(0)
        })
    });
