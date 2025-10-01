// Sitepaige client
// Essentially wrappers around the REST API

import { 
  SitepaigeJobsRequestBody, 
  SitepaigeJobsResponseBody, 
  SitepaigePagesFirstBody, 
  SitepaigePagesFirstResponse,
  SitepaigeCompleteGenerationBody,
  SitepaigeCompleteGenerationResponse,
  SitepaigeProject,
  GenerateSiteParams,
  GenerateSiteResult,
  LayoutOption
} from "./types.js";

export interface RequestOptions {
  onLog?: (message: string) => void;
}

const debugEnv = process.env.SITEPAIGE_DEBUG;
const isDebug = typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase());
const BASE_URL = process.env.SITEPAIGE_BASE_URL || (isDebug ? "http://localhost:3000" : "https://sitepaige.com");
const API_KEY = process.env.SITEPAIGE_API_KEY || "";

if (!API_KEY) {
  console.warn("Warning: SITEPAIGE_API_KEY env var not set.");
}

// Debug logging function
async function debugLog(message: string): Promise<void> {
  if (process.env.SITEPAIGE_DEBUG === '1') {
    console.error('[Sitepaige]', message);
  }
}

/**
 * Internal JSON request helper
 */
async function requestJson<T>(
  method: "GET" | "POST",
  pathname: string,
  body?: unknown,
  opts?: RequestOptions
): Promise<T> {
  const url = `${BASE_URL}${pathname}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  };

  if (isDebug) {
    console.log(`[sitepaige] ${method} ${url}`);
    if (body) console.log(`[sitepaige] Request body:`, JSON.stringify(body, null, 2));
  }

  if (opts?.onLog) {
    opts.onLog(`${method} ${pathname}`);
  }

  const fetchOpts: RequestInit = {
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
      const error = new Error('Insufficient credits') as any;
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }
    throw new Error(`Sitepaige API error: ${resp.status} ${resp.statusText} - ${text}`);
  }

  try {
    const result = JSON.parse(text) as T;
    
    // Debug logging for successful /api/project responses
    if (pathname.includes('/api/project')) {
      await debugLog(`DEBUG: /api/project request succeeded`);
      await debugLog(`Response: ${JSON.stringify(result, null, 2)}`);
    }
    
    return result;
  } catch (err) {
    if (isDebug) {
      console.error(`[sitepaige] Failed to parse JSON response:`, err);
    }
    await debugLog(`Failed to parse JSON response from ${pathname}`);
    await debugLog(`Raw response: ${text}`);
    throw new Error(`Failed to parse Sitepaige API response as JSON: ${text}`);
  }
}

// Generate new Sitepaige project (pages-first only, no backend)
export async function generate_site(
  params: GenerateSiteParams,
  options?: RequestOptions
): Promise<GenerateSiteResult> {
  const {
    projectName,
    requirements,
    targetLocation,
    websiteLanguage,
    requiresAuth,
    login_providers,
    designStyle,
    generateImages,
    imageGenerationStrategy,
    generateLogo,
    selectedLayout,
    selectedColorScheme,
    selectedFont
  } = params;

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
  const jobsBody: SitepaigeJobsRequestBody = {
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

  const jobRes = await requestJson<SitepaigeJobsResponseBody>("POST", "/api/jobs", jobsBody, options);
  const projectId = jobRes.projectId;

  // 2) Pages-first blueprint (FREE for first project, then 12 credits)
  const pagesFirstBody: SitepaigePagesFirstBody = {
    projectId,
    ...(targetLocation ? { targetLocation } : {}),
    ...(websiteLanguage ? { websiteLanguage } : {}),
    ...(requiresAuth !== undefined ? { requiresAuth } : {}),
    ...(designStyle ? { designStyle } : {}),
    ...(generateImages !== undefined ? { generateImages } : {}),
    ...(imageGenerationStrategy ? { imageGenerationStrategy } : {}),
    ...(generateLogo !== undefined ? { generateLogo } : {}),
    ...(selectedLayout ? { selectedLayout } : {}),
    ...(selectedColorScheme ? { selectedColorScheme } : {}),
    ...(selectedFont ? { selectedFont } : {})
  };
  await requestJson<SitepaigePagesFirstResponse>("POST", "/api/agentic/pages-first", pagesFirstBody, options);

  // 3) Fetch project details (which will only have frontend parts)
  const projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
  const project = await requestJson<SitepaigeProject>("GET", projectUrl, undefined, options);

  return {
    projectId,
    mode: jobRes.mode,
    project,
    tbd: "Frontend generated. Use complete_backend to add models and API routes."
  };
}

// Complete backend generation (models/SQL and API routes) - costs 50 credits
export async function complete_backend(
  projectId: string,
  options?: RequestOptions
): Promise<SitepaigeProject> {
  // WARNING: This endpoint costs 50 credits
  // Call complete generation endpoint to add models, SQL migrations, and API routes
  const completeBody: SitepaigeCompleteGenerationBody = { projectId };
  await requestJson<SitepaigeCompleteGenerationResponse>("POST", "/api/agentic/complete-generation", completeBody, options);

  // Fetch updated project details with backend included
  const projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
  const project = await requestJson<SitepaigeProject>("GET", projectUrl, undefined, options);

  return project;
}

// Helper function to build full API URLs
export function buildUrl(pathname: string): string {
  return `${BASE_URL}${pathname}`;
}

// Initialize a site generation and return immediately with projectId
export async function initialize_site_generation(
  params: GenerateSiteParams,
  options?: RequestOptions
): Promise<{ projectId: string; mode: string }> {
  const {
    projectName,
    requirements,
    targetLocation,
    websiteLanguage,
    requiresAuth,
    login_providers,
    designStyle,
    generateImages,
    imageGenerationStrategy,
    generateLogo,
    selectedLayout,
    selectedColorScheme,
    selectedFont
  } = params;

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
  const jobsBody: SitepaigeJobsRequestBody = {
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

  const jobRes = await requestJson<SitepaigeJobsResponseBody>("POST", "/api/jobs", jobsBody, options);
  return {
    projectId: jobRes.projectId,
    mode: jobRes.mode
  };
}

// Continue site generation after initialization (pages-first only)
export async function continue_site_generation(
  projectId: string,
  params: Partial<GenerateSiteParams>,
  options?: RequestOptions
): Promise<void> {
  const {
    targetLocation,
    websiteLanguage,
    requiresAuth,
    designStyle,
    generateImages,
    imageGenerationStrategy,
    generateLogo,
    selectedLayout,
    selectedColorScheme,
    selectedFont
  } = params;

  // Pages-first blueprint (FREE for first project, then 12 credits)
  const pagesFirstBody: SitepaigePagesFirstBody = {
    projectId,
    ...(targetLocation ? { targetLocation } : {}),
    ...(websiteLanguage ? { websiteLanguage } : {}),
    ...(requiresAuth !== undefined ? { requiresAuth } : {}),
    ...(designStyle ? { designStyle } : {}),
    ...(generateImages !== undefined ? { generateImages } : {}),
    ...(imageGenerationStrategy ? { imageGenerationStrategy } : {}),
    ...(generateLogo !== undefined ? { generateLogo } : {}),
    ...(selectedLayout ? { selectedLayout } : {}),
    ...(selectedColorScheme ? { selectedColorScheme } : {}),
    ...(selectedFont ? { selectedFont } : {})
  };
  await requestJson<SitepaigePagesFirstResponse>("POST", "/api/agentic/pages-first", pagesFirstBody, options);
  
  // No longer calling complete-generation here - that's a separate paid operation
}

// Convenience: run generation, then write files to disk based on the blueprint/code (pages only)
export async function generate_site_and_write(
  params: GenerateSiteParams & { targetDir: string },
  options?: RequestOptions
): Promise<GenerateSiteResult & { wroteTo: string }> {
  const res = await generate_site(params, options);
  try {
    const { writeProjectPagesOnly } = await import("./blueprintWriter.js");
    await writeProjectPagesOnly(res.project as any, { 
      targetDir: params.targetDir,
      databaseType: params.databaseType,
      writeApis: false // pages-first generation should never write database or APIs
    });
    return { ...res, wroteTo: params.targetDir };
  } catch (err) {
    // Bubble up but keep original result available to caller
    throw new Error(`Generation succeeded, but writing to disk failed: ${(err as any)?.message ?? String(err)}`);
  }
}

// Fetch existing project by ID
export async function fetch_project_by_id(
  projectId: string,
  options?: RequestOptions & { buildId?: string }
): Promise<SitepaigeProject> {
  let projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
  if (options?.buildId) {
    projectUrl += `&buildId=${encodeURIComponent(options.buildId)}`;
  }
  const project = await requestJson<SitepaigeProject>("GET", projectUrl, undefined, options);
  return project;
}

// Fetch a project and write it to disk (includes APIs if they exist in the project)
export async function write_site_by_project_id(
  params: { projectId: string; targetDir: string; databaseType?: "sqlite" | "postgres" | "mysql" },
  options?: RequestOptions
): Promise<{ project: SitepaigeProject; wroteTo: string }> {
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
    await writeProjectPagesOnly(project as any, { 
      targetDir: params.targetDir,
      databaseType: params.databaseType || "sqlite",
      writeApis: true // write_site_by_project_id will conditionally write APIs/models if they exist
    });
  } catch (error) {
    if (options?.onLog) {
      options.onLog(`[write_site_by_project_id] ERROR in writeProjectPagesOnly: ${error}`);
    }
    throw error;
  }
  return { project, wroteTo: params.targetDir };
}

// Complete backend and write to disk (costs 50 credits)
export async function complete_backend_and_write(
  params: { projectId: string; targetDir: string; databaseType?: "sqlite" | "postgres" | "mysql" },
  options?: RequestOptions
): Promise<{ project: SitepaigeProject; wroteTo: string }> {
  // WARNING: This operation costs 50 credits
  // First complete the backend generation including models, SQL migrations, and API routes
  const project = await complete_backend(params.projectId, options);
  
  if (options?.onLog) {
    options.onLog('[complete_backend_and_write] Fetched project keys: ' + Object.keys(project).join(', '));
    options.onLog('[complete_backend_and_write] Has code? ' + (!!project.code));
    options.onLog('[complete_backend_and_write] Has blueprint? ' + (!!project.blueprint));
    
    if (project.code) {
      options.onLog('[complete_backend_and_write] Code structure: ' + JSON.stringify({
        isObject: typeof project.code === 'object',
        hasApis: 'apis' in project.code,
        hasViews: 'views' in project.code
      }));
    }
  }
  
  // Then write ONLY the backend files (models/SQL, APIs, architecture doc)
  // This ensures we don't overwrite frontend files from generate_site
  try {
    const { writeProjectBackendOnly } = await import("./blueprintWriter.js");
    await writeProjectBackendOnly(project as any, { 
      targetDir: params.targetDir,
      databaseType: params.databaseType || "sqlite"
    });
  } catch (error) {
    if (options?.onLog) {
      options.onLog(`[complete_backend_and_write] ERROR in writeProjectBackendOnly: ${error}`);
    }
    throw error;
  }
  return { project, wroteTo: params.targetDir };
}