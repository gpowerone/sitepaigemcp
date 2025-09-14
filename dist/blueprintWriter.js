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
import path from "node:path";
import { ensureDir } from "./generators/utils.js";
export async function writeProjectFromBlueprint(project, options) {
    const targetDir = path.resolve(options.targetDir);
    ensureDir(targetDir);
    const blueprint = project.blueprint || project.data?.blueprint;
    const projectCode = project.code || project.data?.code;
    if (!blueprint) {
        throw new Error("No blueprint found in project data");
    }
    if (!projectCode) {
        throw new Error("No code found in project data");
    }
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
    const viewMap = await writeViews(targetDir, bpWithImages);
    // Get the collected view styles
    const viewStyles = getViewStyles();
    await updateGlobalCSS(targetDir, bpWithImages, viewStyles);
    await writePages(targetDir, bpWithImages, viewMap);
    await writeApis(targetDir, bpWithImages, projectCode);
    // Write architecture documentation
    await writeArchitectureDoc(targetDir, bpWithImages);
}
// Write project pages only (frontend without models/SQL and API routes)
export async function writeProjectPagesOnly(project, options) {
    const targetDir = path.resolve(options.targetDir);
    ensureDir(targetDir);
    const blueprint = project.blueprint || project.data?.blueprint;
    if (!blueprint) {
        throw new Error("No blueprint found in project data");
    }
    // package.json first to allow immediate npm install
    const projectName = project.name || project.data?.name || undefined;
    await writePackageJson(targetDir, projectName, options.databaseType || "sqlite");
    await writeNextConfig(targetDir);
    await writeBaseAppSkeleton(targetDir);
    // Copy default app files after base skeleton
    await writeDefaultApp(targetDir, options.databaseType || "sqlite");
    await writeComponents(targetDir, blueprint);
    // Skip writeModelsSql and writeIncrementalMigrations
    // Process images: download to public/images and replace refs in blueprint before views/pages
    const bpWithImages = await processBlueprintImages(targetDir, blueprint);
    const viewMap = await writeViews(targetDir, bpWithImages);
    // Get the collected view styles
    const viewStyles = getViewStyles();
    await updateGlobalCSS(targetDir, bpWithImages, viewStyles);
    await writePages(targetDir, bpWithImages, viewMap);
    // Skip writeApis
    // Skip writeArchitectureDoc - only written in complete backend
}
// Write only backend parts (models/SQL, API routes, and architecture doc)
export async function writeProjectBackendOnly(project, options) {
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
//# sourceMappingURL=blueprintWriter.js.map