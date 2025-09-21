import { writeNextConfig, writeBaseAppSkeleton, writePackageJson } from "./generators/skeleton.js";
import { writeModelsSql, writeIncrementalMigrations } from "./generators/sql.js";
import { writeComponents } from "./generators/components.js";
import { writeViews, getViewStyles } from "./generators/views.js";
import { writePages } from "./generators/pages.js";
import { writeApis } from "./generators/apis.js";
import { processBlueprintImages } from "./generators/images.js";
import { writeDefaultApp } from "./generators/defaultapp.js";
import { updateGlobalCSS } from "./generators/design.js";
import { writeArchitectureDoc } from "./generators/architecture.js";
import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./generators/utils.js";
import { Blueprint, Code, ProjectData } from "./types.js";
import fsp from "node:fs/promises";

// Debug logging helper for MCP context
async function debugLog(message: string): Promise<void> {
  try {
    const debugEnv = process.env.SITEPAIGE_DEBUG;
    if (typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase())) {
      const logFile = path.join(process.cwd(), 'sitepaige-debug.log');
      const timestamp = new Date().toISOString();
      await fsp.appendFile(logFile, `[${timestamp}] ${message}\n`);
    }
  } catch {
    // Silently fail if can't write log
  }
}

export interface WriteOptions {
  targetDir: string;
  databaseType?: "sqlite" | "postgres" | "mysql";
  writeApis?: boolean; // For writeProjectPagesOnly - whether to include APIs
}

interface ProjectInput {
  blueprint?: Blueprint;
  data?: {
    blueprint?: Blueprint;
    code?: Code;
    name?: string;
  };
  code?: Code;
  name?: string;
  AuthProviders?: {
    apple: boolean;
    facebook: boolean;
    github: boolean;
    google: boolean;
  };
}

export async function writeProjectFromBlueprint(project: ProjectInput, options: WriteOptions): Promise<void> {
  const targetDir = path.resolve(options.targetDir);
  ensureDir(targetDir);

  const blueprint = project.blueprint || project.data?.blueprint;
  const projectCode = project.code || project.data?.code;
  
  await debugLog('[writeProjectFromBlueprint] project structure: ' + JSON.stringify({
    hasBlueprint: !!project.blueprint,
    hasDataBlueprint: !!(project.data?.blueprint),
    hasCode: !!project.code,
    hasDataCode: !!(project.data?.code)
  }));

  if (!blueprint) {
    throw new Error("No blueprint found in project data");
  }

  if (!projectCode) {
    await debugLog('[writeProjectFromBlueprint] WARNING: No code found in project data');
    throw new Error("No code found in project data");
  }
  
  await debugLog('[writeProjectFromBlueprint] projectCode structure: ' + JSON.stringify({
    hasApis: !!projectCode.apis,
    apisCount: projectCode.apis?.length || 0,
    hasViews: !!projectCode.views,
    viewsCount: projectCode.views?.length || 0
  }));

  // package.json first to allow immediate npm install
  const projectName = project.name || project.data?.name || undefined;
  await writePackageJson(targetDir, projectName, options.databaseType || "sqlite");
  await writeNextConfig(targetDir);
  await writeBaseAppSkeleton(targetDir);
  // Copy default app files after base skeleton
  await writeDefaultApp(targetDir, options.databaseType || "sqlite");
  await writeComponents(targetDir, blueprint);
  await writeModelsSql(targetDir, blueprint, options.databaseType || "sqlite");
  await writeIncrementalMigrations(targetDir, blueprint, options.databaseType || "sqlite");
  // Process images: download to public/images and replace refs in blueprint before views/pages
  const bpWithImages = await processBlueprintImages(targetDir, blueprint);
  const viewMap = await writeViews(targetDir, bpWithImages, projectCode, project.AuthProviders);
  // Get the collected view styles
  const viewStyles = getViewStyles();

  await updateGlobalCSS(targetDir, bpWithImages, viewStyles);
  await writePages(targetDir, bpWithImages, viewMap);
  await writeApis(targetDir, bpWithImages, projectCode);
  
  // Write architecture documentation
  await writeArchitectureDoc(targetDir, bpWithImages);
}

// Write project pages only (frontend without models/SQL and API routes)
export async function writeProjectPagesOnly(project: ProjectInput, options: WriteOptions): Promise<void> {
  const targetDir = path.resolve(options.targetDir);
  ensureDir(targetDir);

  const blueprint = project.blueprint || project.data?.blueprint;
  const projectCode = project.code || project.data?.code;
  
  await debugLog('[writeProjectPagesOnly] Called with options: ' + JSON.stringify({
    targetDir: options.targetDir,
    databaseType: options.databaseType,
    writeApis: options.writeApis
  }));
  
  await debugLog('[writeProjectPagesOnly] project structure: ' + JSON.stringify({
    hasBlueprint: !!project.blueprint,
    hasDataBlueprint: !!(project.data?.blueprint),
    hasCode: !!project.code,
    hasDataCode: !!(project.data?.code)
  }));

  if (!blueprint) {
    throw new Error("No blueprint found in project data");
  }
  
  if (projectCode) {
    await debugLog('[writeProjectPagesOnly] projectCode structure: ' + JSON.stringify({
      hasApis: !!projectCode.apis,
      apisCount: projectCode.apis?.length || 0,
      hasViews: !!projectCode.views,
      viewsCount: projectCode.views?.length || 0
    }));
  } else {
    await debugLog('[writeProjectPagesOnly] WARNING: No projectCode provided');
  }

  // package.json first to allow immediate npm install
  const projectName = project.name || project.data?.name || undefined;
  await writePackageJson(targetDir, projectName, options.databaseType || "sqlite");
  await writeNextConfig(targetDir);
  await writeBaseAppSkeleton(targetDir);
  // Copy default app files after base skeleton
  await writeDefaultApp(targetDir, options.databaseType || "sqlite");
  await writeComponents(targetDir, blueprint);
  
  // Write database/models if requested and they exist in blueprint
  const hasModels = blueprint.models && blueprint.models.length > 0;
  if (options.writeApis && hasModels) {
    await debugLog('[writeProjectPagesOnly] Writing models/migrations (writeApis=true and models exist)');
    await writeModelsSql(targetDir, blueprint, options.databaseType || "sqlite");
    await writeIncrementalMigrations(targetDir, blueprint, options.databaseType || "sqlite");
  } else {
    await debugLog('[writeProjectPagesOnly] Skipping models/migrations (writeApis=' + options.writeApis + ', hasModels=' + hasModels + ')');
  }
  
  // Process images: download to public/images and replace refs in blueprint before views/pages
  const bpWithImages = await processBlueprintImages(targetDir, blueprint);
  const viewMap = await writeViews(targetDir, bpWithImages, projectCode, project.AuthProviders);
  // Get the collected view styles
  const viewStyles = getViewStyles();

  await updateGlobalCSS(targetDir, bpWithImages, viewStyles);
  await writePages(targetDir, bpWithImages, viewMap);
  
  // Conditionally write APIs based on writeApis option AND if they exist in code
  const hasApis = projectCode && projectCode.apis && projectCode.apis.length > 0;
  if (options.writeApis && hasApis) {
    await debugLog('[writeProjectPagesOnly] Writing APIs (writeApis=true and APIs exist)');
    await writeApis(targetDir, bpWithImages, projectCode);
  } else {
    await debugLog('[writeProjectPagesOnly] Skipping APIs (writeApis=' + options.writeApis + ', hasApis=' + hasApis + ')');
  }
  
  // Skip writeArchitectureDoc - only written in complete backend
}

// Write only backend parts (models/SQL, API routes, and architecture doc)
export async function writeProjectBackendOnly(project: ProjectInput, options: WriteOptions): Promise<void> {
  const targetDir = path.resolve(options.targetDir);
  
  const blueprint = project.blueprint || project.data?.blueprint;
  const projectCode = project.code || project.data?.code;

  if (!blueprint) {
    throw new Error("No blueprint found in project data");
  }

  if (!projectCode) {
    throw new Error("No code found in project data");
  }

  // Only write backend-specific files
  await writeModelsSql(targetDir, blueprint, options.databaseType || "sqlite");
  await writeIncrementalMigrations(targetDir, blueprint, options.databaseType || "sqlite");
  await writeApis(targetDir, blueprint, projectCode);
  
  // Write architecture documentation (now includes backend)
  await writeArchitectureDoc(targetDir, blueprint);
}


