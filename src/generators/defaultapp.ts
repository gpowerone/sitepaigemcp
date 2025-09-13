import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir } from "./utils.js";

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyDirectory(source: string, destination: string): Promise<void> {
  ensureDir(destination);
  
  const entries = await fsp.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else if (entry.isFile()) {
      // Only copy if the file doesn't already exist
      if (!fs.existsSync(destPath)) {
        await fsp.copyFile(sourcePath, destPath);
      }
    }
  }
}

async function copyDirectoryWithExclusions(source: string, destination: string, excludeFiles: string[]): Promise<void> {
  ensureDir(destination);
  
  const entries = await fsp.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectoryWithExclusions(sourcePath, destPath, excludeFiles);
    } else if (entry.isFile() && !excludeFiles.includes(entry.name)) {
      // Only copy if the file doesn't already exist and is not in the exclude list
      if (!fs.existsSync(destPath)) {
        await fsp.copyFile(sourcePath, destPath);
      }
    }
  }
}

export async function writeDefaultApp(targetDir: string, databaseType: "sqlite" | "postgres" | "mysql" = "sqlite"): Promise<void> {
  // The defaultapp folder is at the root of the project
  const defaultAppPath = path.join(__dirname, "..", "..", "defaultapp");
  const appDir = path.join(targetDir, "src", "app");
  
  // Ensure the app directory exists
  ensureDir(appDir);
  
  // Copy all contents from defaultapp to src/app, excluding database files we'll handle separately
  const excludeFiles = ['db.ts', 'db-sqlite.ts', 'db-postgres.ts', 'db-mysql.ts', 'db-users.ts', 'util.ts', 'middleware.ts', 'csrf.ts'];
  await copyDirectoryWithExclusions(defaultAppPath, appDir, excludeFiles);
  
  // Copy database files based on selected database type
  const dbFiles = ['db-users.ts', 'util.ts', 'csrf.ts'];
  
  // Copy the common database files
  for (const file of dbFiles) {
    const sourcePath = path.join(defaultAppPath, file);
    const destPath = path.join(appDir, file);
    if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
      await fsp.copyFile(sourcePath, destPath);
    }
  }
  
  // Copy middleware.ts to the src directory (not src/app)
  const middlewareSourcePath = path.join(defaultAppPath, 'middleware.ts');
  const middlewareDestPath = path.join(targetDir, 'src', 'middleware.ts');
  if (fs.existsSync(middlewareSourcePath) && !fs.existsSync(middlewareDestPath)) {
    await fsp.copyFile(middlewareSourcePath, middlewareDestPath);
  }
  
  // Copy only the selected database implementation
  const dbImplFile = `db-${databaseType}.ts`;
  const sourceDbImplPath = path.join(defaultAppPath, dbImplFile);
  const destDbImplPath = path.join(appDir, dbImplFile);
  if (fs.existsSync(sourceDbImplPath) && !fs.existsSync(destDbImplPath)) {
    await fsp.copyFile(sourceDbImplPath, destDbImplPath);
  }
  
  // Generate the db.ts file from template
  const dbTemplatePath = path.join(__dirname, "db-template.txt");
  const dbTemplate = await fsp.readFile(dbTemplatePath, "utf8");
  const dbContent = dbTemplate.replace('{{DATABASE_TYPE}}', databaseType);
  const dbPath = path.join(appDir, "db.ts");
  if (!fs.existsSync(dbPath)) {
    await fsp.writeFile(dbPath, dbContent, "utf8");
  }
  
  // Create .env.example file
  const envExamplePath = path.join(targetDir, ".env.example");
  if (!fs.existsSync(envExamplePath)) {
    const envTemplate = await fsp.readFile(path.join(__dirname, "env-example-template.txt"), "utf8");
    // Update the default DATABASE_TYPE based on the selected database
    const updatedEnvTemplate = envTemplate.replace(
      "DATABASE_TYPE=sqlite", 
      `DATABASE_TYPE=${databaseType}`
    );
    await fsp.writeFile(envExamplePath, updatedEnvTemplate, "utf8");
  }
  
  // Create DATABASE_SETUP.md file
  const dbSetupPath = path.join(targetDir, "DATABASE_SETUP.md");
  if (!fs.existsSync(dbSetupPath)) {
    const dbReadmeTemplate = await fsp.readFile(path.join(__dirname, "database-readme-template.md"), "utf8");
    await fsp.writeFile(dbSetupPath, dbReadmeTemplate, "utf8");
  }
}
