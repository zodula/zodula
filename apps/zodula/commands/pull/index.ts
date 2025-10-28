import { Command } from "nailgun";
import { loader } from "../../server/loader";
import { logger } from "../../server/logger";
import { startup } from "../../server/startup";
import { $ } from "bun";
import fs from "fs";
import path from "path";

export default new Command("pull")
    .description("Pull latest code for all apps with git repositories")
    .action(async () => {
        try {
            await startup();

            logger.info("🔄 Checking for apps to pull...");

            // Get all apps
            const apps = loader.from("app").list();

            if (apps.length === 0) {
                logger.info("No apps found to pull");
                return;
            }

            let pulledCount = 0;
            let skippedCount = 0;

            for (const app of apps) {
                const appPath = app.dir;
                const gitPath = path.join(appPath, '.git');

                // Check if app has git repository
                if (!fs.existsSync(gitPath)) {
                    logger.info(`⏭️  Skipping ${app.packageName} - no git repository`);
                    skippedCount++;
                    continue;
                }

                try {
                    logger.info(`🔄 Pulling ${app.packageName}...`);

                    // Check if there are any uncommitted changes
                    const statusResult = await $`cd ${appPath} && git status --porcelain`.text();
                    if (statusResult.trim()) {
                        logger.warn(`⚠️  ${app.packageName} has uncommitted changes, skipping pull`);
                        skippedCount++;
                        continue;
                    }

                    // Get current branch
                    const currentBranch = await $`cd ${appPath} && git branch --show-current`.text();
                    const branch = currentBranch.trim();

                    // Pull latest changes
                    const pullResult = await $`cd ${appPath} && git pull origin ${branch}`.text();

                    if (pullResult.includes('Already up to date')) {
                        logger.info(`✅ ${app.packageName} is already up to date`);
                    } else {
                        logger.success(`✅ ${app.packageName} pulled successfully`);
                        pulledCount++;
                    }

                } catch (error) {
                    logger.error(`❌ Failed to pull ${app.packageName}:`, error);
                    skippedCount++;
                }
            }

            // Summary
            logger.info(`\n📊 Pull Summary:`);
            logger.info(`   ✅ Pulled: ${pulledCount} apps`);
            logger.info(`   ⏭️  Skipped: ${skippedCount} apps`);

            if (pulledCount === 0 && skippedCount === 0) {
                logger.info(`   ℹ️  No apps found to pull`);
            }
        } catch (error) {
            logger.error(`❌ Failed to pull:`, error);
            process.exit(1);
        } finally {
            process.exit(0);
        }
    });
