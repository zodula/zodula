import { Command } from "nailgun";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import inquirer from "inquirer";
import { doMigrate } from "../migrate";

const listBackups = (backupDir: string) => {
    if (!existsSync(backupDir)) {
        return [];
    }

    return readdirSync(backupDir)
        .filter(file => file.endsWith('.zip'))
        .map(file => {
            const stats = statSync(join(backupDir, file));
            return {
                name: file,
                path: join(backupDir, file),
                size: stats.size,
                date: stats.mtime,
                sizeFormatted: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                dateFormatted: stats.mtime.toISOString().split('T')[0]
            };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());
};

const restoreFromBackup = async (backupPath: string, cwd: string) => {
    const zodulaDataPath = join(cwd, ".zodula_data");

    try {
        console.log("🔄 Restoring backup...");

        // Check if .zodula_data exists and ask for confirmation to overwrite
        if (existsSync(zodulaDataPath)) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: '⚠️  .zodula_data directory already exists. This will overwrite all existing data. Continue?',
                    default: false
                }
            ]);

            if (!confirm) {
                console.log("❌ Restore cancelled.");
                return;
            }

            console.log("🗑️  Removing existing .zodula_data directory...");
            rmSync(zodulaDataPath, { recursive: true, force: true });
        }

        // Extract the backup
        console.log("📦 Extracting backup...");
        const extractCommand = `cd "${cwd}" && unzip -q "${backupPath}"`;
        execSync(extractCommand, { stdio: 'inherit' });

        // Verify extraction
        if (existsSync(zodulaDataPath)) {
            const stats = statSync(zodulaDataPath);
            console.log("✅ Backup restored successfully!");
            console.log(`📁 Restored to: ${zodulaDataPath}`);
            console.log(`📊 Directory size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        } else {
            throw new Error("Failed to restore backup - .zodula_data directory not found after extraction");
        }

    } catch (error) {
        console.error("❌ Error restoring backup:", error);
        process.exit(1);
    }
};

const selectBackup = async (backups: any[]) => {
    if (backups.length === 0) {
        console.log("❌ No backup files found in .zodula_backup directory.");
        return null;
    }

    const choices = backups.map((backup, index) => ({
        name: `${backup.name} (${backup.sizeFormatted}, ${backup.dateFormatted})`,
        value: backup.path
    }));

    const { selectedBackup } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedBackup',
            message: 'Select a backup to restore:',
            choices: choices,
            pageSize: 10
        }
    ]);

    return selectedBackup;
};

const restoreCommand = async (filePath?: string) => {
    const cwd = process.cwd();
    const backupDir = join(cwd, ".zodula_backup");

    let selectedBackup: string;

    if (filePath) {
        // Use provided file path
        if (!existsSync(filePath)) {
            console.log(`❌ Backup file not found: ${filePath}`);
            return;
        }

        if (!filePath.endsWith('.zip')) {
            console.log("❌ Backup file must be a .zip file.");
            return;
        }

        selectedBackup = filePath;
        console.log(`📁 Using backup file: ${filePath}`);
    } else {
        // Interactive mode - check if backup directory exists
        if (!existsSync(backupDir)) {
            console.log("❌ No .zodula_backup directory found. Please create a backup first using 'bun run backup'.");
            return;
        }

        // List available backups
        const backups = listBackups(backupDir);

        if (backups.length === 0) {
            console.log("❌ No backup files found in .zodula_backup directory.");
            return;
        }

        console.log(`📋 Found ${backups.length} backup(s):`);
        backups.forEach((backup, index) => {
            console.log(`  ${index + 1}. ${backup.name} (${backup.sizeFormatted}, ${backup.dateFormatted})`);
        });

        // Select backup to restore
        const interactiveSelection = await selectBackup(backups);

        if (!interactiveSelection) {
            console.log("❌ No backup selected.");
            return;
        }

        selectedBackup = interactiveSelection;
    }

    // Confirm restore
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to restore from ${selectedBackup}?`,
            default: false
        }
    ]);

    if (!confirm) {
        console.log("❌ Restore cancelled.");
        return;
    }

    // Restore the backup
    await restoreFromBackup(selectedBackup, cwd);
};

export default new Command("restore")
    .description("Restore .zodula_data from a backup file")
    .option("-f, --file <path>", "Path to the backup file to restore from")
    .action(async (options) => {
        await restoreCommand(options.file);
        await doMigrate("main")
        process.exit(0);
    });
