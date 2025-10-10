import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import path from "node:path";
import fsp from "node:fs/promises";
import { JobRegistry } from "./jobRegistry.js";
import { write_site_by_project_id, fetch_project_by_id, initialize_site_generation, continue_site_generation, complete_backend_and_write } from "./sitepaige.js";
export { generate_site, complete_backend } from "./sitepaige.js";
export { writeProjectFromBlueprint } from "./blueprintWriter.js";
const server = new McpServer({ name: "sitepaige-mcp-server", version: "0.1.0" });
const transport = new StdioServerTransport();
const jobs = new JobRegistry();
// Debug logging function
async function debugLog(message) {
    if (process.env.SITEPAIGE_DEBUG === '1') {
        console.error('[Sitepaige-MCP]', message);
    }
}
function publishResourceListChanged() {
    server.sendResourceListChanged();
}
async function runGenerateJob(jobId, prompt, targetDir, projectNameArg, databaseType, login_providers, designStyle, generateImages, imageGenerationStrategy, generateLogo, selectedLayout, selectedColorScheme, selectedFont) {
    try {
        jobs.setStatus(jobId, { status: "running", step: "generate", progressPercent: 5 });
        jobs.appendLog(jobId, `Starting job ${jobId}`);
        const debugEnv = process.env.SITEPAIGE_DEBUG;
        const debug = typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase());
        if (debug)
            jobs.appendLog(jobId, `Debug: invoking Sitepaige API`);
        const providedName = (projectNameArg ?? "").trim();
        const projectName = providedName ? providedName.slice(0, 60) : "My Project";
        // Initialize the site generation (quick call to get projectId)
        const { projectId, mode } = await initialize_site_generation({
            projectName,
            requirements: prompt,
            databaseType: databaseType || "sqlite",
            login_providers: login_providers || "google",
            designStyle,
            generateImages,
            imageGenerationStrategy,
            generateLogo,
            selectedLayout: selectedLayout,
            selectedColorScheme,
            selectedFont
        }, {
            onLog: (message) => jobs.appendLog(jobId, message)
        });
        // Store the projectId, targetDir, and databaseType in the job
        jobs.setProjectId(jobId, projectId);
        jobs.setTargetDir(jobId, targetDir);
        jobs.setDatabaseType(jobId, databaseType || "sqlite");
        jobs.appendLog(jobId, `Project initialized with ID: ${projectId}, mode: ${mode}`);
        jobs.setStatus(jobId, { step: "generating", progressPercent: 20 });
        // Continue generation asynchronously (don't await)
        continue_site_generation(projectId, {
            designStyle,
            generateImages,
            imageGenerationStrategy,
            generateLogo,
            selectedLayout: selectedLayout,
            selectedColorScheme,
            selectedFont
        }, {
            onLog: (message) => jobs.appendLog(jobId, message)
        }).then(async () => {
            jobs.appendLog(jobId, `Frontend generation complete for project ${projectId}.`);
            jobs.setStatus(jobId, { status: "completed", step: "writing", progressPercent: 90 });
            // Write the generated files to the target directory
            try {
                // Check if target directory is empty first
                const { readdirSync } = await import("fs");
                const { resolve } = await import("path");
                const targetPath = resolve(targetDir);
                let dirEntries = [];
                try {
                    dirEntries = readdirSync(targetPath);
                }
                catch (e) {
                    // Directory doesn't exist, that's fine
                }
                const hasFiles = dirEntries.some(entry => !entry.startsWith('.'));
                if (hasFiles) {
                    jobs.appendLog(jobId, `Target directory ${targetDir} is not empty. Skipping file write to avoid overwriting.`);
                    jobs.setStatus(jobId, { status: "completed", step: "done", progressPercent: 100 });
                    publishResourceListChanged();
                    return;
                }
                // Fetch the project and write files
                const { write_site_by_project_id } = await import("./sitepaige.js");
                await write_site_by_project_id({
                    projectId,
                    targetDir,
                    databaseType: databaseType || "sqlite"
                }, {
                    onLog: (message) => jobs.appendLog(jobId, message)
                });
                jobs.appendLog(jobId, `Project files written to ${targetDir}`);
                jobs.setResult(jobId, {
                    created: ["Project files written successfully"],
                    updated: [],
                    skipped: [],
                    conflicts: [],
                    backups: []
                });
                jobs.setStatus(jobId, { status: "completed", step: "done", progressPercent: 100 });
                publishResourceListChanged();
            }
            catch (writeErr) {
                jobs.appendLog(jobId, `Error writing files: ${writeErr?.message ?? String(writeErr)}`);
                jobs.setStatus(jobId, { status: "completed", step: "done", progressPercent: 100 });
                publishResourceListChanged();
            }
        }).catch(err => {
            jobs.appendLog(jobId, `Error during generation: ${err?.message ?? String(err)}`);
            jobs.setStatus(jobId, { status: "failed", step: "error", progressPercent: 100, errorMessage: err?.message ?? String(err) });
            publishResourceListChanged();
        });
        // Return projectId immediately
        return projectId;
    }
    catch (err) {
        // Check if this is an insufficient credits error
        if (err?.code === 'INSUFFICIENT_CREDITS') {
            const message = `Insufficient credits: The user needs to purchase credits to create another website. Please direct them to upgrade their account or purchase more credits.`;
            jobs.appendLog(jobId, message);
            jobs.setStatus(jobId, {
                status: "failed",
                step: "error",
                progressPercent: 100,
                errorMessage: message
            });
        }
        else {
            jobs.appendLog(jobId, `Error: ${err?.message ?? String(err)}`);
            jobs.setStatus(jobId, { status: "failed", step: "error", progressPercent: 100, errorMessage: err?.message ?? String(err) });
        }
        publishResourceListChanged();
        throw err; // Re-throw to be handled by the caller
    }
}
async function runWriteJob(jobId, projectId, targetDir) {
    try {
        jobs.setStatus(jobId, { status: "running", step: "fetch_project", progressPercent: 10 });
        jobs.appendLog(jobId, `Starting write job ${jobId} for project ${projectId}`);
        const debugEnv = process.env.SITEPAIGE_DEBUG;
        const debug = typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase());
        if (debug)
            jobs.appendLog(jobId, `Debug: fetching project from /api/project and writing to disk`);
        let project, wroteTo;
        try {
            const result = await write_site_by_project_id({ projectId, targetDir }, {
                onLog: (message) => jobs.appendLog(jobId, message)
            });
            project = result.project;
            wroteTo = result.wroteTo;
            jobs.appendLog(jobId, `write_site_by_project_id completed`);
        }
        catch (error) {
            console.error(`[runWriteJob] ERROR in write_site_by_project_id:`, error);
            jobs.appendLog(jobId, `ERROR in write_site_by_project_id: ${error}`);
            throw error;
        }
        void project; // not used further in this flow
        jobs.setStatus(jobId, { step: "finalize", progressPercent: 95 });
        jobs.setResult(jobId, { created: [], updated: [], skipped: [], conflicts: [], backups: [] });
        jobs.appendLog(jobId, `Project written to ${wroteTo}`);
        jobs.setStatus(jobId, { status: "completed", step: "done", progressPercent: 100 });
    }
    catch (err) {
        jobs.appendLog(jobId, `Error: ${err?.message ?? String(err)}`);
        jobs.setStatus(jobId, { status: "failed", step: "error", progressPercent: 100, errorMessage: err?.message ?? String(err) });
    }
    finally {
        publishResourceListChanged();
    }
}
async function runCompleteBackendJob(jobId, projectId, targetDir, databaseType) {
    try {
        jobs.setStatus(jobId, { status: "running", step: "complete_backend", progressPercent: 10 });
        jobs.appendLog(jobId, `Starting backend completion job ${jobId} for project ${projectId}`);
        jobs.appendLog(jobId, `WARNING: This operation will consume 50 credits`);
        const debugEnv = process.env.SITEPAIGE_DEBUG;
        const debug = typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase());
        if (debug)
            jobs.appendLog(jobId, `Debug: calling complete_backend_and_write`);
        let project, wroteTo;
        try {
            jobs.setStatus(jobId, { step: "generating_backend", progressPercent: 30 });
            const result = await complete_backend_and_write({ projectId, targetDir, databaseType: databaseType || "sqlite" }, {
                onLog: (message) => jobs.appendLog(jobId, message)
            });
            project = result.project;
            wroteTo = result.wroteTo;
            jobs.appendLog(jobId, `Backend generation and writing completed`);
        }
        catch (error) {
            console.error(`[runCompleteBackendJob] ERROR:`, error);
            jobs.appendLog(jobId, `ERROR: ${error?.message ?? String(error)}`);
            // Check for insufficient credits
            if (error?.code === 'INSUFFICIENT_CREDITS') {
                throw error; // Re-throw to be handled by caller
            }
            throw error;
        }
        jobs.setStatus(jobId, { step: "finalize", progressPercent: 95 });
        jobs.setResult(jobId, {
            created: ["Backend files written: models, SQL migrations, API routes, ARCHITECTURE.md"],
            updated: [],
            skipped: ["Frontend files preserved"],
            conflicts: [],
            backups: []
        });
        jobs.appendLog(jobId, `Backend files written to ${wroteTo}. Frontend files were preserved.`);
        jobs.setStatus(jobId, { status: "completed", step: "done", progressPercent: 100 });
    }
    catch (err) {
        // Check if this is an insufficient credits error
        if (err?.code === 'INSUFFICIENT_CREDITS') {
            const message = `Insufficient credits: The user needs 50 credits to complete backend generation. Please direct them to upgrade their account or purchase more credits.`;
            jobs.appendLog(jobId, message);
            jobs.setStatus(jobId, {
                status: "failed",
                step: "error",
                progressPercent: 100,
                errorMessage: message
            });
        }
        else {
            jobs.appendLog(jobId, `Error: ${err?.message ?? String(err)}`);
            jobs.setStatus(jobId, { status: "failed", step: "error", progressPercent: 100, errorMessage: err?.message ?? String(err) });
        }
    }
    finally {
        publishResourceListChanged();
    }
}
server.tool("generate_site", {
    prompt: z.string().min(1),
    targetDir: z.string().min(1),
    projectName: z.string().optional(),
    databaseType: z.enum(["sqlite", "postgres", "mysql"]).optional().default("sqlite"),
    login_providers: z.string().optional().default("google"),
    designStyle: z.string().optional(),
    generateImages: z.boolean().optional(),
    imageGenerationStrategy: z.enum(["AI", "Unsplash", "None"]).optional(),
    generateLogo: z.boolean().optional(),
    selectedLayout: z.enum([
        "classic-hero",
        "split-hero",
        "full-height-hero",
        "centered-simple",
        "navigation-heavy",
        "compact-hero",
        "asymmetric-hero",
        "gradient-hero"
    ]).optional(),
    // Website color scheme parameters
    websiteBackgroundColor: z.string().optional().default("#ffffff"),
    websiteTextColor: z.string().optional().default("#333333"),
    websiteHeaderColor: z.string().optional().default("#000000"),
    websiteButtonColor: z.string().optional().default("#516ab8"),
    websiteButtonTextColor: z.string().optional().default("#ffffff"),
    // Hero color scheme parameters
    heroBackgroundColor: z.string().optional().default("#f0f0f0"),
    heroTextColor: z.string().optional().default("#333333"),
    heroHeaderColor: z.string().optional().default("#000000"),
    heroButtonColor: z.string().optional().default("#516ab8"),
    heroButtonTextColor: z.string().optional().default("#ffffff"),
    // Website font parameters
    websiteHeaderFont: z.string().optional().default("Roboto"),
    websiteMenuFont: z.string().optional().default("Roboto"),
    websiteButtonFont: z.string().optional().default("Roboto"),
    websiteTextFont: z.string().optional().default("Roboto"),
    // Hero font parameters
    heroHeaderFont: z.string().optional().default("Roboto"),
    heroButtonFont: z.string().optional().default("Roboto"),
    heroTextFont: z.string().optional().default("Roboto")
}, async ({ prompt, targetDir, projectName, databaseType, login_providers, designStyle, generateImages, imageGenerationStrategy, generateLogo, selectedLayout, 
// Website colors
websiteBackgroundColor, websiteTextColor, websiteHeaderColor, websiteButtonColor, websiteButtonTextColor, 
// Hero colors
heroBackgroundColor, heroTextColor, heroHeaderColor, heroButtonColor, heroButtonTextColor, 
// Website fonts
websiteHeaderFont, websiteMenuFont, websiteButtonFont, websiteTextFont, 
// Hero fonts
heroHeaderFont, heroButtonFont, heroTextFont }) => {
    // Construct the color scheme JSON from individual parameters
    const colorScheme = {
        website: {
            background: websiteBackgroundColor,
            text: websiteTextColor,
            header: websiteHeaderColor,
            button: websiteButtonColor,
            buttonText: websiteButtonTextColor
        },
        hero: {
            background: heroBackgroundColor,
            text: heroTextColor,
            header: heroHeaderColor,
            button: heroButtonColor,
            buttonText: heroButtonTextColor
        }
    };
    const selectedColorScheme = JSON.stringify(colorScheme);
    // Construct the font scheme JSON from individual parameters
    const fontScheme = {
        website: {
            headerFont: websiteHeaderFont,
            menuFont: websiteMenuFont,
            buttonFont: websiteButtonFont,
            textFont: websiteTextFont
        },
        hero: {
            headerFont: heroHeaderFont,
            buttonFont: heroButtonFont,
            textFont: heroTextFont
        }
    };
    const selectedFont = JSON.stringify(fontScheme);
    // Site generation typically takes around 5 minutes
    const job = jobs.createJob(300, 150); // 5 minutes expected, poll every 2.5 minutes
    const baseUri = `mem://jobs/${job.id}`;
    publishResourceListChanged();
    try {
        // Wait for the projectId from the initial API call
        const projectId = await runGenerateJob(job.id, prompt, targetDir, projectName, databaseType, login_providers, designStyle, generateImages, imageGenerationStrategy, generateLogo, selectedLayout, selectedColorScheme, selectedFont);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        status: "generating",
                        jobId: job.id,
                        projectId: projectId, // Return the projectId to the client
                        targetDir: targetDir,
                        statusUri: `${baseUri}/status`,
                        logsUri: `${baseUri}/logs`,
                        planUri: `${baseUri}/plan`,
                        resultUri: `${baseUri}/result`,
                        expectedDurationSeconds: 300,
                        recommendedPollingIntervalSeconds: 150,
                        hint: "Frontend generation started in the background and typically takes 5-7 minutes. Files will be written automatically to the target directory when generation completes. To add backend functionality later, use complete_backend (50 credits)."
                    })
                }
            ]
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        jobId: job.id,
                        error: err?.message ?? String(err),
                        errorCode: err?.code
                    })
                }
            ]
        };
    }
});
server.tool("get_status", {
    jobId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    targetDir: z.string().min(1).optional(),
    buildId: z.string().min(1).optional()
}, async ({ jobId, projectId, targetDir, buildId }) => {
    await debugLog(`get_status called with: jobId=${jobId}, projectId=${projectId}, targetDir=${targetDir}, buildId=${buildId}`);
    // Validate input - need either jobId or (projectId + targetDir)
    if (!jobId && (!projectId || !targetDir)) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: "Either jobId or both projectId and targetDir are required"
                    })
                }
            ]
        };
    }
    let actualProjectId;
    let actualTargetDir;
    let actualDatabaseType;
    let job = null;
    // If jobId provided, try to get details from job registry
    if (jobId) {
        job = jobs.getJob(jobId);
        if (job) {
            actualProjectId = job.projectId;
            actualTargetDir = job.targetDir;
            actualDatabaseType = job.databaseType;
        }
    }
    // If projectId provided directly, use it (overrides job registry)
    if (projectId) {
        actualProjectId = projectId;
    }
    if (targetDir) {
        actualTargetDir = targetDir;
    }
    // Check if we have the required information
    if (!actualProjectId || !actualTargetDir) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        status: "missing_info",
                        message: "Missing projectId or targetDir. Please provide both.",
                        hasProjectId: !!actualProjectId,
                        hasTargetDir: !!actualTargetDir
                    })
                }
            ]
        };
    }
    try {
        // Query the project status
        await debugLog(`Fetching project with ID: ${actualProjectId}, buildId: ${buildId}`);
        const project = await fetch_project_by_id(actualProjectId, buildId ? { buildId } : undefined);
        await debugLog(`Project response: ${JSON.stringify(project, null, 2)}`);
        // Check if the project status indicates completion
        // The project object should have a status field or we check if it has the required data
        const isComplete = project && project.blueprint && project.code;
        await debugLog(`Project completion status: isComplete=${isComplete}, hasBlueprint=${!!project?.blueprint}, hasCode=${!!project?.code}`);
        if (isComplete && actualTargetDir) {
            // Check if files were already written
            const filesWritten = job && job.result && job.result.created && job.result.created.length > 0;
            if (!filesWritten) {
                try {
                    // Check if target directory already has content
                    const targetPath = path.resolve(actualTargetDir);
                    let dirExists = false;
                    let hasContent = false;
                    try {
                        const stats = await fsp.stat(targetPath);
                        dirExists = stats.isDirectory();
                        if (dirExists) {
                            const entries = await fsp.readdir(targetPath);
                            // Ignore common safe entries like .git, .DS_Store, etc.
                            const significantEntries = entries.filter(e => !e.startsWith('.') && e !== 'node_modules' && e !== '__pycache__');
                            hasContent = significantEntries.length > 0;
                        }
                    }
                    catch (err) {
                        // Directory doesn't exist, which is fine
                        dirExists = false;
                        hasContent = false;
                    }
                    if (hasContent) {
                        if (job && jobId) {
                            jobs.appendLog(jobId, `Target directory ${actualTargetDir} already contains files. Aborting to prevent overwriting.`);
                        }
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({
                                        status: "directory_not_empty",
                                        jobId,
                                        projectId: actualProjectId,
                                        message: "Target directory already contains files. Please use an empty directory to prevent overwriting existing files.",
                                        targetDir: actualTargetDir
                                    })
                                }
                            ]
                        };
                    }
                    // Write the project files
                    // Check if there are models or APIs in the blueprint to decide what to write
                    const hasModels = !!(project.blueprint?.models && Array.isArray(project.blueprint.models) && project.blueprint.models.length > 0);
                    const hasApis = !!(project.code?.apis && Array.isArray(project.code.apis) && project.code.apis.length > 0);
                    const shouldWriteBackend = hasModels || hasApis;
                    if (job && jobId) {
                        jobs.appendLog(jobId, `Project has models: ${hasModels}, has APIs: ${hasApis}`);
                    }
                    const { writeProjectPagesOnly } = await import("./blueprintWriter.js");
                    await writeProjectPagesOnly(project, {
                        targetDir: actualTargetDir,
                        databaseType: actualDatabaseType || "sqlite",
                        writeApis: shouldWriteBackend // Only write backend stuff if it exists
                    });
                    // Fetch and write library files
                    if (job && jobId) {
                        jobs.appendLog(jobId, `Fetching library files for project: ${actualProjectId}`);
                    }
                    try {
                        const { fetch_all_library_files, write_library_files_and_update_blueprint } = await import("./sitepaige.js");
                        const libraryFiles = await fetch_all_library_files(actualProjectId, {
                            onLog: job && jobId ? (msg) => jobs.appendLog(jobId, msg) : undefined
                        });
                        if (job && jobId) {
                            jobs.appendLog(jobId, `Found library files - Images: ${libraryFiles.images.length}, Files: ${libraryFiles.files.length}, Videos: ${libraryFiles.videos.length}`);
                        }
                        // Write library files and update blueprint in one step
                        if (project.blueprint) {
                            await write_library_files_and_update_blueprint(actualTargetDir, libraryFiles, project.blueprint, {
                                onLog: job && jobId ? (msg) => jobs.appendLog(jobId, msg) : undefined
                            });
                            if (job && jobId) {
                                jobs.appendLog(jobId, `Successfully wrote library files and updated views`);
                            }
                            // Re-write views with updated blueprint
                            const { writeViews, getViewStyles } = await import("./generators/views.js");
                            const { updateGlobalCSS } = await import("./generators/design.js");
                            const { processBlueprintImages } = await import("./generators/images.js");
                            const bpWithImages = await processBlueprintImages(actualTargetDir, project.blueprint);
                            const viewMap = await writeViews(actualTargetDir, bpWithImages, project.code, project.AuthProviders);
                            const viewStyles = getViewStyles();
                            await updateGlobalCSS(actualTargetDir, bpWithImages, viewStyles);
                            if (job && jobId) {
                                jobs.appendLog(jobId, `Views updated with library files`);
                            }
                        }
                    }
                    catch (libError) {
                        const errorMsg = `Warning: Failed to fetch/write library files: ${libError}`;
                        if (job && jobId) {
                            jobs.appendLog(jobId, errorMsg);
                        }
                        await debugLog(errorMsg);
                    }
                    // Update job status if we have a job
                    if (job && jobId) {
                        jobs.setResult(jobId, {
                            created: ["Project files written successfully"],
                            updated: [],
                            skipped: [],
                            conflicts: [],
                            backups: []
                        });
                        jobs.appendLog(jobId, `Project files written to ${actualTargetDir}`);
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    status: "success",
                                    jobId,
                                    projectId: actualProjectId,
                                    message: "Frontend generation complete and files written successfully. To add backend functionality, use complete_backend (50 credits).",
                                    targetDir: actualTargetDir
                                })
                            }
                        ]
                    };
                }
                catch (writeError) {
                    if (job && jobId) {
                        jobs.appendLog(jobId, `Error writing files: ${writeError?.message ?? String(writeError)}`);
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    status: "write_error",
                                    jobId,
                                    projectId: actualProjectId,
                                    error: writeError?.message ?? String(writeError)
                                })
                            }
                        ]
                    };
                }
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                status: "already_written",
                                jobId,
                                projectId: actualProjectId,
                                message: "Files have already been written for this project",
                                targetDir: actualTargetDir
                            })
                        }
                    ]
                };
            }
        }
        else {
            await debugLog(`Returning 'generating' status because isComplete=false`);
            await debugLog(`Project state: blueprint=${!!project?.blueprint}, code=${!!project?.code}`);
            if (project) {
                await debugLog(`Full project object: ${JSON.stringify(project, null, 2)}`);
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            status: "generating",
                            jobId,
                            projectId: actualProjectId,
                            message: "Project is still being generated. Please check again later."
                        })
                    }
                ]
            };
        }
    }
    catch (err) {
        // If there's any error (network, API, etc.), just return that it's still generating
        // This could mean the project is still being created or there was a temporary issue
        await debugLog(`Error in get_status: ${err?.message ?? String(err)}`);
        await debugLog(`Error stack: ${err?.stack}`);
        await debugLog(`Returning 'generating' status due to error`);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        status: "generating",
                        jobId,
                        projectId: actualProjectId,
                        message: "Project is still being generated. Please check again later."
                    })
                }
            ]
        };
    }
});
server.tool("complete_backend", {
    projectId: z.string().min(1),
    targetDir: z.string().min(1),
    databaseType: z.enum(["sqlite", "postgres", "mysql"]).optional().default("sqlite")
}, async ({ projectId, targetDir, databaseType }) => {
    // Backend completion typically takes 2-3 minutes
    const job = jobs.createJob(180, 90); // 3 minutes expected, poll every 1.5 minutes
    const baseUri = `mem://jobs/${job.id}`;
    publishResourceListChanged();
    // Store project info in the job for status checking
    jobs.setProjectId(job.id, projectId);
    jobs.setTargetDir(job.id, targetDir);
    jobs.setDatabaseType(job.id, databaseType || "sqlite");
    // Start the backend completion job asynchronously
    void runCompleteBackendJob(job.id, projectId, targetDir, databaseType);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    status: "generating",
                    jobId: job.id,
                    projectId: projectId,
                    targetDir: targetDir,
                    statusUri: `${baseUri}/status`,
                    logsUri: `${baseUri}/logs`,
                    planUri: `${baseUri}/plan`,
                    resultUri: `${baseUri}/result`,
                    expectedDurationSeconds: 180,
                    recommendedPollingIntervalSeconds: 90,
                    creditsCost: 50,
                    warning: "This operation will consume 50 credits from your account",
                    hint: "Backend generation started. This will add models, SQL migrations, API routes, and ARCHITECTURE.md to your project. Frontend files will be preserved. Use get_status to check progress."
                })
            }
        ]
    };
});
server.resource("job_statuses", "mem://jobs/{jobId}/status", { mimeType: "application/json" }, async (uri) => {
    const res = jobs.readResource(uri.toString());
    if (!res)
        throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    let text = res.body;
    try {
        const status = JSON.parse(res.body);
        if (status && typeof status === "object" && typeof status.status === "string") {
            const map = { running: "generating", completed: "complete" };
            const external = {
                ...status,
                status: map[status.status] ?? status.status,
                // Ensure polling hints are preserved
                expectedDurationSeconds: status.expectedDurationSeconds,
                recommendedPollingIntervalSeconds: status.recommendedPollingIntervalSeconds
            };
            text = JSON.stringify(external, null, 2);
        }
    }
    catch {
        // fall back to raw body if not JSON
    }
    return { contents: [{ uri: uri.toString(), mimeType: res.mimeType, text }] };
});
server.resource("job_logs", "mem://jobs/{jobId}/logs", { mimeType: "text/plain" }, async (uri) => {
    const res = jobs.readResource(uri.toString());
    if (!res)
        throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    return { contents: [{ uri: uri.toString(), mimeType: res.mimeType, text: res.body }] };
});
server.resource("job_plan", "mem://jobs/{jobId}/plan", { mimeType: "text/markdown" }, async (uri) => {
    const res = jobs.readResource(uri.toString());
    if (!res)
        throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    return { contents: [{ uri: uri.toString(), mimeType: res.mimeType, text: res.body }] };
});
server.resource("job_result", "mem://jobs/{jobId}/result", { mimeType: "application/json" }, async (uri) => {
    const res = jobs.readResource(uri.toString());
    if (!res)
        throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    return { contents: [{ uri: uri.toString(), mimeType: res.mimeType, text: res.body }] };
});
await server.connect(transport);
//# sourceMappingURL=index.js.map