import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir } from "./utils.js";
// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function copyDirectory(source, destination) {
    ensureDir(destination);
    const entries = await fsp.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, destPath);
        }
        else if (entry.isFile()) {
            // Only copy if the file doesn't already exist
            if (!fs.existsSync(destPath)) {
                await fsp.copyFile(sourcePath, destPath);
            }
        }
    }
}
export async function writeDefaultApp(targetDir, databaseType = "postgres") {
    // The defaultapp folder is at the root of the project
    const defaultAppPath = path.join(__dirname, "..", "..", "defaultapp");
    const defaultPublicPath = path.join(__dirname, "..", "..", "defaultpublic");
    const appDir = path.join(targetDir, "src", "app");
    const publicDir = path.join(targetDir, "public");
    // Ensure the app directory exists
    ensureDir(appDir);
    // Copy all contents from defaultapp to src/app
    await copyDirectory(defaultAppPath, appDir);
    // Copy defaultpublic folder to public directory if it exists
    if (fs.existsSync(defaultPublicPath)) {
        await copyDirectory(defaultPublicPath, publicDir);
    }
    // Copy middleware.ts to the src directory (not src/app)
    const middlewareSourcePath = path.join(defaultAppPath, 'middleware.ts');
    const middlewareDestPath = path.join(targetDir, 'src', 'middleware.ts');
    if (fs.existsSync(middlewareSourcePath) && !fs.existsSync(middlewareDestPath)) {
        await fsp.copyFile(middlewareSourcePath, middlewareDestPath);
    }
    // Create .env.example file
    const envExamplePath = path.join(targetDir, ".env.example");
    if (!fs.existsSync(envExamplePath)) {
        const envTemplate = await fsp.readFile(path.join(__dirname, "env-example-template.txt"), "utf8");
        // Update the default DATABASE_TYPE based on the selected database
        const updatedEnvTemplate = envTemplate.replace("DATABASE_TYPE=sqlite", `DATABASE_TYPE=${databaseType}`);
        await fsp.writeFile(envExamplePath, updatedEnvTemplate, "utf8");
    }
    // DATABASE_SETUP.md is now written by writeModelsSql when migrations are created
}
//# sourceMappingURL=defaultapp.js.map