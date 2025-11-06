// Sitepaige client
// Essentially wrappers around the REST API
const debugEnv = process.env.SITEPAIGE_DEBUG;
const isDebug = typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase());
const BASE_URL = process.env.SITEPAIGE_BASE_URL || (isDebug ? "http://localhost:3000" : "https://sitepaige.com");
const API_KEY = process.env.SITEPAIGE_API_KEY || "";
if (!API_KEY) {
    console.warn("Warning: SITEPAIGE_API_KEY env var not set.");
}
// Debug logging function
async function debugLog(message) {
    if (process.env.SITEPAIGE_DEBUG === '1') {
        console.error('[Sitepaige]', message);
    }
}
/**
 * Internal JSON request helper
 */
async function requestJson(method, pathname, body, opts) {
    const url = `${BASE_URL}${pathname}`;
    const headers = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        ...(opts?.headers || {})
    };
    if (isDebug) {
        console.log(`[sitepaige] ${method} ${url}`);
        if (body)
            console.log(`[sitepaige] Request body:`, JSON.stringify(body, null, 2));
    }
    if (opts?.onLog) {
        opts.onLog(`${method} ${pathname}`);
    }
    const fetchOpts = {
        method,
        headers
    };
    if (body !== undefined) {
        fetchOpts.body = JSON.stringify(body);
    }
    const resp = await fetch(url, fetchOpts);
    const text = await resp.text();
    if (isDebug) {
        console.log(`[sitepaige] Response status: ${resp.status}`);
        console.log(`[sitepaige] Response body:`, text);
    }
    if (!resp.ok) {
        // Enhanced debug logging for failed requests
        await debugLog(`Failed request to ${pathname}`);
        await debugLog(`Response status: ${resp.status} ${resp.statusText}`);
        await debugLog(`Response headers: ${JSON.stringify(Object.fromEntries(resp.headers.entries()))}`);
        await debugLog(`Response body: ${text}`);
        // Special debug for /api/project endpoint
        if (pathname.includes('/api/project')) {
            await debugLog(`DEBUG: /api/project request failed`);
            await debugLog(`Full URL: ${url}`);
            await debugLog(`Request method: ${method}`);
            if (body) {
                await debugLog(`Request body: ${JSON.stringify(body, null, 2)}`);
            }
        }
        // Check for insufficient credits error
        if (resp.status === 400 && text.includes('Insufficient credits')) {
            const error = new Error('Insufficient credits');
            error.code = 'INSUFFICIENT_CREDITS';
            throw error;
        }
        throw new Error(`Sitepaige API error: ${resp.status} ${resp.statusText} - ${text}`);
    }
    try {
        const result = JSON.parse(text);
        // Debug logging for successful /api/project responses
        if (pathname.includes('/api/project')) {
            await debugLog(`DEBUG: /api/project request succeeded`);
            await debugLog(`Response: ${JSON.stringify(result, null, 2)}`);
        }
        return result;
    }
    catch (err) {
        if (isDebug) {
            console.error(`[sitepaige] Failed to parse JSON response:`, err);
        }
        await debugLog(`Failed to parse JSON response from ${pathname}`);
        await debugLog(`Raw response: ${text}`);
        throw new Error(`Failed to parse Sitepaige API response as JSON: ${text}`);
    }
}
// Generate new Sitepaige project (pages-first only, no backend)
export async function generate_site(params, options) {
    const { projectName, requirements, targetLocation, websiteLanguage, requiresAuth, login_providers, designStyle, generateLogo, selectedLayout, selectedColorScheme, selectedFont } = params;
    // Parse login_providers into authProviders object
    const loginProvidersStr = login_providers || 'google';
    const providersArray = loginProvidersStr.split(',').map(p => p.trim().toLowerCase());
    const authProviders = {
        google: providersArray.includes('google'),
        facebook: providersArray.includes('facebook'),
        github: providersArray.includes('github'),
        apple: providersArray.includes('apple')
    };
    // 1) Create project via /api/jobs
    const jobsBody = {
        projectName,
        ideaText: requirements,
        requiresAuth: requiresAuth ?? true,
        // Send other fields only if provided to let server use defaults
        targetLocation: targetLocation ?? null,
        websiteLanguage: websiteLanguage ?? null,
        baasProvider: null,
        authProviders: authProviders,
        userTiers: null,
        paymentProcessor: null,
        relationalDatabase: null,
        objectDatabase: null,
        generateLogo: null,
        analytics: null,
        requirements: null
    };
    const jobRes = await requestJson("POST", "/api/jobs", jobsBody, options);
    const projectId = jobRes.projectId;
    // 2) Pages-first blueprint (FREE for first project, then 12 credits)
    const pagesFirstBody = {
        projectId,
        ...(targetLocation ? { targetLocation } : {}),
        ...(websiteLanguage ? { websiteLanguage } : {}),
        ...(requiresAuth !== undefined ? { requiresAuth } : {}),
        ...(designStyle ? { designStyle } : {}),
        ...(generateLogo !== undefined ? { generateLogo } : {}),
        ...(selectedLayout ? { selectedLayout } : {}),
        ...(selectedColorScheme ? { selectedColorScheme } : {}),
        ...(selectedFont ? { selectedFont } : {})
    };
    await requestJson("POST", "/api/agentic/pages-first", pagesFirstBody, options);
    // 3) Fetch project details (which will only have frontend parts)
    const projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
    const project = await requestJson("GET", projectUrl, undefined, options);
    return {
        projectId,
        mode: jobRes.mode,
        project,
        tbd: "Site generated successfully."
    };
}
// Helper function to build full API URLs
export function buildUrl(pathname) {
    return `${BASE_URL}${pathname}`;
}
// Initialize a site generation and return immediately with projectId
export async function initialize_site_generation(params, options) {
    const { projectName, requirements, targetLocation, websiteLanguage, requiresAuth, login_providers, designStyle, generateLogo, selectedLayout, selectedColorScheme, selectedFont } = params;
    // Parse login_providers into authProviders object
    const loginProvidersStr = login_providers || 'google';
    const providersArray = loginProvidersStr.split(',').map(p => p.trim().toLowerCase());
    const authProviders = {
        google: providersArray.includes('google'),
        facebook: providersArray.includes('facebook'),
        github: providersArray.includes('github'),
        apple: providersArray.includes('apple')
    };
    // Create project via /api/jobs
    const jobsBody = {
        projectName,
        ideaText: requirements,
        requiresAuth: requiresAuth ?? true,
        // Send other fields only if provided to let server use defaults
        targetLocation: targetLocation ?? null,
        websiteLanguage: websiteLanguage ?? null,
        baasProvider: null,
        authProviders: authProviders,
        userTiers: null,
        paymentProcessor: null,
        relationalDatabase: null,
        objectDatabase: null,
        generateLogo: null,
        analytics: null,
        requirements: null
    };
    const jobRes = await requestJson("POST", "/api/jobs", jobsBody, options);
    return {
        projectId: jobRes.projectId,
        mode: jobRes.mode
    };
}
// Continue site generation after initialization (complete frontend + backend)
export async function continue_site_generation(projectId, params, options) {
    const { targetLocation, websiteLanguage, requiresAuth, designStyle, generateLogo, selectedLayout, selectedColorScheme, selectedFont } = params;
    // Build complete site (frontend + backend) - takes 8-10 minutes
    const buildSiteBody = {
        projectId,
        isSimpleApp: false, // Default to full site
        ...(designStyle ? { designStyle } : {}),
        ...(targetLocation ? { targetLocation } : {}),
        ...(websiteLanguage ? { websiteLanguage } : {}),
        ...(requiresAuth !== undefined ? { requiresAuth } : {}),
        generateImages: true, // Always generate images
        imageGenerationStrategy: 'AI', // Always use AI
        ...(generateLogo !== undefined ? { generateLogo } : {}),
        ...(selectedLayout ? { selectedLayout } : {}),
        ...(selectedColorScheme ? { selectedColorScheme } : {}),
        ...(selectedFont ? { selectedFont } : {})
    };
    await requestJson("POST", "/api/agentic/build-site", buildSiteBody, {
        ...options,
        headers: {
            ...options?.headers,
            'X-Long-Running-Request': 'true'
        }
    });
}
// Convenience: run generation, then write files to disk based on the blueprint/code (pages only)
export async function generate_site_and_write(params, options) {
    const res = await generate_site(params, options);
    try {
        const { writeProjectPagesOnly } = await import("./blueprintWriter.js");
        await writeProjectPagesOnly(res.project, {
            targetDir: params.targetDir,
            databaseType: params.databaseType,
            writeApis: false // pages-first generation should never write database or APIs
        });
        // Fetch and write library files
        try {
            const libraryFiles = await fetch_all_library_files(res.projectId, options);
            // Write library files and update blueprint in one step
            if (res.project.blueprint) {
                await write_library_files_and_update_blueprint(params.targetDir, libraryFiles, res.project.blueprint, options);
                // Re-write views with updated blueprint
                const { writeViews, getViewStyles } = await import("./generators/views.js");
                const { updateGlobalCSS } = await import("./generators/design.js");
                const { processBlueprintImages } = await import("./generators/images.js");
                const bpWithImages = await processBlueprintImages(params.targetDir, res.project.blueprint);
                const viewMap = await writeViews(params.targetDir, bpWithImages, res.project.code, res.project.AuthProviders);
                const viewStyles = getViewStyles();
                await updateGlobalCSS(params.targetDir, bpWithImages, viewStyles);
            }
        }
        catch (libError) {
            if (options?.onLog) {
                options.onLog(`[generate_site_and_write] Warning: Failed to fetch/write library files: ${libError}`);
            }
        }
        return { ...res, wroteTo: params.targetDir };
    }
    catch (err) {
        // Bubble up but keep original result available to caller
        throw new Error(`Generation succeeded, but writing to disk failed: ${err?.message ?? String(err)}`);
    }
}
// Fetch existing project by ID
export async function fetch_project_by_id(projectId, options) {
    let projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
    if (options?.buildId) {
        projectUrl += `&buildId=${encodeURIComponent(options.buildId)}`;
    }
    const project = await requestJson("GET", projectUrl, undefined, options);
    return project;
}
// Fetch a project and write it to disk (includes APIs if they exist in the project)
export async function write_site_by_project_id(params, options) {
    const project = await fetch_project_by_id(params.projectId, options);
    if (options?.onLog) {
        options.onLog('[write_site_by_project_id] Fetched project keys: ' + Object.keys(project).join(', '));
        options.onLog('[write_site_by_project_id] Has code? ' + (!!project.code));
        options.onLog('[write_site_by_project_id] Has blueprint? ' + (!!project.blueprint));
        if (project.code) {
            options.onLog('[write_site_by_project_id] Code structure: ' + JSON.stringify({
                isObject: typeof project.code === 'object',
                hasApis: 'apis' in project.code,
                hasViews: 'views' in project.code
            }));
        }
    }
    try {
        const { writeProjectPagesOnly } = await import("./blueprintWriter.js");
        await writeProjectPagesOnly(project, {
            targetDir: params.targetDir,
            databaseType: params.databaseType || "postgres",
            writeApis: true // write_site_by_project_id will conditionally write APIs/models if they exist
        });
        // Fetch and write library files
        await debugLog(`[write_site_by_project_id] About to fetch library files for project: ${params.projectId}`);
        if (options?.onLog) {
            options.onLog(`[write_site_by_project_id] About to fetch library files for project: ${params.projectId}`);
        }
        try {
            const libraryFiles = await fetch_all_library_files(params.projectId, options);
            await debugLog(`[write_site_by_project_id] Successfully fetched library files`);
            // Write library files and update blueprint
            if (project.blueprint) {
                await write_library_files_and_update_blueprint(params.targetDir, libraryFiles, project.blueprint, options);
                await debugLog(`[write_site_by_project_id] Successfully wrote library files and updated blueprint`);
                // Re-write views with updated blueprint
                const { writeViews, getViewStyles } = await import("./generators/views.js");
                const { updateGlobalCSS } = await import("./generators/design.js");
                const { processBlueprintImages } = await import("./generators/images.js");
                const bpWithImages = await processBlueprintImages(params.targetDir, project.blueprint);
                const viewMap = await writeViews(params.targetDir, bpWithImages, project.code, project.AuthProviders);
                const viewStyles = getViewStyles();
                await updateGlobalCSS(params.targetDir, bpWithImages, viewStyles);
            }
        }
        catch (libError) {
            const errorMsg = `[write_site_by_project_id] Failed to fetch/write library files: ${libError}`;
            await debugLog(errorMsg);
            if (options?.onLog) {
                options.onLog(`Warning: ${errorMsg}`);
            }
        }
    }
    catch (error) {
        if (options?.onLog) {
            options.onLog(`[write_site_by_project_id] ERROR in writeProjectPagesOnly: ${error}`);
        }
        throw error;
    }
    return { project, wroteTo: params.targetDir };
}
// Fetch library images for a project
export async function fetch_library_images(projectId, options) {
    try {
        await debugLog(`[fetch_library_images] Fetching images for project: ${projectId}`);
        const response = await requestJson("GET", `/api/image/library/list?projectId=${encodeURIComponent(projectId)}`, undefined, options);
        const images = response.images || [];
        await debugLog(`[fetch_library_images] Found ${images.length} images`);
        return images;
    }
    catch (error) {
        await debugLog(`[fetch_library_images] Error: ${error}`);
        return [];
    }
}
// Fetch library files for a project
export async function fetch_library_files(projectId, options) {
    try {
        await debugLog(`[fetch_library_files] Fetching files for project: ${projectId}`);
        const response = await requestJson("GET", `/api/files/list?projectId=${encodeURIComponent(projectId)}`, undefined, options);
        const files = response.files || [];
        await debugLog(`[fetch_library_files] Found ${files.length} files`);
        return files;
    }
    catch (error) {
        await debugLog(`[fetch_library_files] Error: ${error}`);
        return [];
    }
}
// Fetch library videos for a project
export async function fetch_library_videos(projectId, options) {
    try {
        await debugLog(`[fetch_library_videos] Fetching videos for project: ${projectId}`);
        const response = await requestJson("GET", `/api/video/list?projectId=${encodeURIComponent(projectId)}`, undefined, options);
        const videos = response.videos || [];
        await debugLog(`[fetch_library_videos] Found ${videos.length} videos`);
        return videos;
    }
    catch (error) {
        await debugLog(`[fetch_library_videos] Error: ${error}`);
        return [];
    }
}
// Fetch all library files for a project
export async function fetch_all_library_files(projectId, options) {
    await debugLog(`[fetch_all_library_files] Fetching library files for project: ${projectId}`);
    const [images, files, videos] = await Promise.all([
        fetch_library_images(projectId, options),
        fetch_library_files(projectId, options),
        fetch_library_videos(projectId, options)
    ]);
    await debugLog(`[fetch_all_library_files] Fetched - Images: ${images.length}, Files: ${files.length}, Videos: ${videos.length}`);
    return { images, files, videos };
}
// Helper to fetch binary data and convert to base64
async function fetchBinaryAsBase64(url, options) {
    const fullUrl = `${BASE_URL}${url}`;
    const headers = {
        "Authorization": `Bearer ${API_KEY}`
    };
    if (options?.onLog) {
        options.onLog(`Fetching binary from: ${url}`);
    }
    const resp = await fetch(fullUrl, { headers });
    if (!resp.ok) {
        throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
}
// Download and write library files to disk
export async function write_library_files_and_update_blueprint(targetDir, libraryFiles, blueprint, options) {
    await debugLog(`[write_library_files_and_update_blueprint] Starting - targetDir: ${targetDir}`);
    const { writeLibraryFile } = await import("./blueprintWriter.js");
    if (!writeLibraryFile) {
        throw new Error("writeLibraryFile function not found in blueprintWriter");
    }
    if (options?.onLog) {
        options.onLog(`[write_library_files_and_update_blueprint] Writing library files - Images: ${libraryFiles.images.length}, Files: ${libraryFiles.files.length}, Videos: ${libraryFiles.videos.length}`);
    }
    // Create mappings for gallery updates
    const imageIdToFilename = new Map();
    const videoIdToFilename = new Map();
    const fileIdToFilename = new Map();
    // Write images
    for (const image of libraryFiles.images) {
        try {
            if (options?.onLog) {
                options.onLog(`[write_library_files_and_update_blueprint] Downloading image: ${image.Name} (${image.ImageID})`);
            }
            const base64Data = await fetchBinaryAsBase64(`/api/image?imageid=${encodeURIComponent(image.ImageID)}`, options);
            const actualFilename = await writeLibraryFile(targetDir, 'image', image.Name, base64Data);
            imageIdToFilename.set(image.ImageID, actualFilename);
            await debugLog(`[write_library_files_and_update_blueprint] Successfully wrote image: ${actualFilename}`);
        }
        catch (error) {
            const errorMsg = `[write_library_files_and_update_blueprint] Error downloading image ${image.Name}: ${error}`;
            await debugLog(errorMsg);
            if (options?.onLog) {
                options.onLog(errorMsg);
            }
        }
    }
    // Write files
    for (const file of libraryFiles.files) {
        try {
            if (options?.onLog) {
                options.onLog(`[write_library_files_and_update_blueprint] Downloading file: ${file.Name} (${file.FileID})`);
            }
            const base64Data = await fetchBinaryAsBase64(`/api/files?fileid=${encodeURIComponent(file.FileID)}`, options);
            const actualFilename = await writeLibraryFile(targetDir, 'file', file.Name, base64Data);
            fileIdToFilename.set(file.FileID, actualFilename);
            await debugLog(`[write_library_files_and_update_blueprint] Successfully wrote file: ${actualFilename}`);
        }
        catch (error) {
            const errorMsg = `[write_library_files_and_update_blueprint] Error downloading file ${file.Name}: ${error}`;
            await debugLog(errorMsg);
            if (options?.onLog) {
                options.onLog(errorMsg);
            }
        }
    }
    // Write videos
    for (const video of libraryFiles.videos) {
        try {
            if (options?.onLog) {
                options.onLog(`[write_library_files_and_update_blueprint] Downloading video: ${video.Name} (${video.VideoID})`);
            }
            const base64Data = await fetchBinaryAsBase64(`/api/video?videoid=${encodeURIComponent(video.VideoID)}`, options);
            const actualFilename = await writeLibraryFile(targetDir, 'video', video.Name, base64Data);
            videoIdToFilename.set(video.VideoID, actualFilename);
            await debugLog(`[write_library_files_and_update_blueprint] Successfully wrote video: ${actualFilename}`);
            // Download thumbnail if exists
            if (video.ThumbnailID) {
                try {
                    if (options?.onLog) {
                        options.onLog(`[write_library_files_and_update_blueprint] Downloading thumbnail for video: ${video.Name}`);
                    }
                    const thumbBase64 = await fetchBinaryAsBase64(`/api/image?imageid=${encodeURIComponent(video.ThumbnailID)}`, options);
                    const thumbName = `${video.Name.replace(/\.[^.]+$/, '')}_thumb.jpg`;
                    const actualThumbName = await writeLibraryFile(targetDir, 'image', thumbName, thumbBase64);
                    imageIdToFilename.set(video.ThumbnailID, actualThumbName);
                    await debugLog(`[write_library_files_and_update_blueprint] Successfully wrote video thumbnail: ${actualThumbName}`);
                }
                catch (error) {
                    const errorMsg = `[write_library_files_and_update_blueprint] Error downloading video thumbnail for ${video.Name}: ${error}`;
                    await debugLog(errorMsg);
                    if (options?.onLog) {
                        options.onLog(errorMsg);
                    }
                }
            }
        }
        catch (error) {
            const errorMsg = `[write_library_files_and_update_blueprint] Error downloading video ${video.Name}: ${error}`;
            await debugLog(errorMsg);
            if (options?.onLog) {
                options.onLog(errorMsg);
            }
        }
    }
    // Now update blueprint views with the simplified gallery configurations
    if (blueprint?.views && Array.isArray(blueprint.views)) {
        for (const view of blueprint.views) {
            if (view.type === 'photogallery' && view.custom_view_description) {
                try {
                    const oldConfig = typeof view.custom_view_description === 'string'
                        ? JSON.parse(view.custom_view_description)
                        : view.custom_view_description;
                    // Create new simplified config
                    const newConfig = {
                        photos: oldConfig.photos?.map((photo) => ({
                            fileName: imageIdToFilename.get(photo.imageId) || 'placeholder.png',
                            label: photo.label
                        })) || [],
                        gridConfig: oldConfig.gridConfig
                    };
                    view.custom_view_description = JSON.stringify(newConfig);
                    await debugLog(`[write_library_files_and_update_blueprint] Updated photogallery ${view.name} with ${newConfig.photos.length} photos`);
                }
                catch (e) {
                    console.error('Error updating photogallery config:', e);
                }
            }
            else if (view.type === 'videogallery' && view.custom_view_description) {
                try {
                    const oldConfig = typeof view.custom_view_description === 'string'
                        ? JSON.parse(view.custom_view_description)
                        : view.custom_view_description;
                    // Create new simplified config
                    const newConfig = {
                        videos: oldConfig.videos?.map((video) => {
                            if (video.type === 'upload' && video.videoId) {
                                return {
                                    type: 'upload',
                                    fileName: videoIdToFilename.get(video.videoId),
                                    title: video.title,
                                    description: video.description,
                                    thumbnailFileName: video.thumbnail ? imageIdToFilename.get(video.thumbnail) : undefined
                                };
                            }
                            else {
                                // Keep YouTube/Vimeo/external videos as-is
                                return {
                                    type: video.type,
                                    url: video.url,
                                    title: video.title,
                                    description: video.description
                                };
                            }
                        }) || [],
                        gridConfig: oldConfig.gridConfig,
                        playerConfig: oldConfig.playerConfig,
                        displayConfig: oldConfig.displayConfig
                    };
                    view.custom_view_description = JSON.stringify(newConfig);
                    await debugLog(`[write_library_files_and_update_blueprint] Updated videogallery ${view.name} with ${newConfig.videos.length} videos`);
                }
                catch (e) {
                    console.error('Error updating videogallery config:', e);
                }
            }
        }
    }
    await debugLog(`[write_library_files_and_update_blueprint] Completed writing library files and updating blueprint`);
}
//# sourceMappingURL=sitepaige.js.map