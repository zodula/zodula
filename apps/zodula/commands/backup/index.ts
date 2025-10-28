import { Command } from "nailgun";
import { existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

const createBackup = async () => {
    const cwd = process.cwd();
    const zodulaDataPath = join(cwd, ".zodula_data");
    const backupDir = join(cwd, ".zodula_backup");
    
    // Check if .zodula_data exists
    if (!existsSync(zodulaDataPath)) {
        console.log("No .zodula_data directory found. Nothing to backup.");
        return;
    }
    
    // Create .zodula_backup directory if it doesn't exist
    if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
        console.log("Created .zodula_backup directory");
    }
    
    // Generate timestamped backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `zodula-backup-${timestamp}.zip`;
    const backupPath = join(backupDir, backupFilename);
    
    try {
        // Use zip command to create backup
        // -r: recursive
        // -q: quiet mode
        // -x: exclude patterns (exclude any existing backup files)
        const zipCommand = `cd "${cwd}" && zip -r "${backupPath}" .zodula_data -x "*.zip"`;
        
        console.log("Creating backup...");
        execSync(zipCommand, { stdio: 'inherit' });
        
        // Get backup file size
        const stats = statSync(backupPath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Backup created successfully: ${backupFilename}`);
        console.log(`📁 Location: ${backupPath}`);
        console.log(`📊 Size: ${fileSizeInMB} MB`);
        
        // List existing backups
        const existingBackups = readdirSync(backupDir)
            .filter(file => file.endsWith('.zip'))
            .sort()
            .reverse();
            
        if (existingBackups.length > 1) {
            console.log(`\n📋 Existing backups (${existingBackups.length} total):`);
            existingBackups.slice(0, 5).forEach((backup, index) => {
                const backupStats = statSync(join(backupDir, backup));
                const size = (backupStats.size / (1024 * 1024)).toFixed(2);
                const date = backupStats.mtime.toISOString().split('T')[0];
                console.log(`  ${index + 1}. ${backup} (${size} MB, ${date})`);
            });
            if (existingBackups.length > 5) {
                console.log(`  ... and ${existingBackups.length - 5} more`);
            }
        }
        
    } catch (error) {
        console.error("❌ Error creating backup:", error);
        process.exit(1);
    }
};

export default new Command("backup")
    .description("Create a backup of .zodula_data files")
    .action(async () => {
        await createBackup();
        process.exit(0);
    });
