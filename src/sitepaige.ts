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
  GenerateSiteResult
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
    // Check for insufficient credits error
    if (resp.status === 400 && text.includes('Insufficient credits')) {
      const error = new Error('Insufficient credits') as any;
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }
    throw new Error(`Sitepaige API error: ${resp.status} ${resp.statusText} - ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    if (isDebug) {
      console.error(`[sitepaige] Failed to parse JSON response:`, err);
    }
    throw new Error(`Failed to parse Sitepaige API response as JSON: ${text}`);
  }
}

// Generate new Sitepaige project
export async function generate_site(
  params: GenerateSiteParams,
  options?: RequestOptions
): Promise<GenerateSiteResult> {
  const {
    projectName,
    requirements,
    designStyle,
    colorScheme,
    targetLocation,
    websiteLanguage,
    requiresAuth,
    login_providers
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
    designStyle: designStyle ?? null,
    colorScheme: colorScheme ?? null,
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

  // 2) Pages-first blueprint
  const pagesFirstBody: SitepaigePagesFirstBody = {
    projectId,
    ...(designStyle ? { designStyle } : {}),
    ...(colorScheme ? { colorScheme } : {}),
    ...(targetLocation ? { targetLocation } : {}),
    ...(websiteLanguage ? { websiteLanguage } : {}),
    ...(requiresAuth !== undefined ? { requiresAuth } : {})
  };
  await requestJson<SitepaigePagesFirstResponse>("POST", "/api/agentic/pages-first", pagesFirstBody, options);

  // 3) Complete generation
  const completeBody: SitepaigeCompleteGenerationBody = { projectId };
  await requestJson<SitepaigeCompleteGenerationResponse>("POST", "/api/agentic/complete-generation", completeBody, options);

  // 4) Fetch project details
  const projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
  const project = await requestJson<SitepaigeProject>("GET", projectUrl, undefined, options);

  return {
    projectId,
    mode: jobRes.mode,
    project,
    tbd: "TBD: further processing/integration will be implemented in the next phase."
  };
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
    designStyle,
    colorScheme,
    targetLocation,
    websiteLanguage,
    requiresAuth,
    login_providers
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
    designStyle: designStyle ?? null,
    colorScheme: colorScheme ?? null,
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

// Continue site generation after initialization
export async function continue_site_generation(
  projectId: string,
  params: Partial<GenerateSiteParams>,
  options?: RequestOptions
): Promise<void> {
  const {
    designStyle,
    colorScheme,
    targetLocation,
    websiteLanguage,
    requiresAuth
  } = params;

  // Pages-first blueprint
  const pagesFirstBody: SitepaigePagesFirstBody = {
    projectId,
    ...(designStyle ? { designStyle } : {}),
    ...(colorScheme ? { colorScheme } : {}),
    ...(targetLocation ? { targetLocation } : {}),
    ...(websiteLanguage ? { websiteLanguage } : {}),
    ...(requiresAuth !== undefined ? { requiresAuth } : {})
  };
  await requestJson<SitepaigePagesFirstResponse>("POST", "/api/agentic/pages-first", pagesFirstBody, options);

  // Complete generation
  const completeBody: SitepaigeCompleteGenerationBody = { projectId };
  await requestJson<SitepaigeCompleteGenerationResponse>("POST", "/api/agentic/complete-generation", completeBody, options);
}

// Convenience: run generation, then write files to disk based on the blueprint/code
export async function generate_site_and_write(
  params: GenerateSiteParams & { targetDir: string },
  options?: RequestOptions
): Promise<GenerateSiteResult & { wroteTo: string }> {
  const res = await generate_site(params, options);
  try {
    const { writeProjectFromBlueprint } = await import("./blueprintWriter.js");
    await writeProjectFromBlueprint(res.project as any, { 
      targetDir: params.targetDir,
      databaseType: params.databaseType 
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
  options?: RequestOptions
): Promise<SitepaigeProject> {
  const projectUrl = `/api/project?id=${encodeURIComponent(projectId)}`;
  const project = await requestJson<SitepaigeProject>("GET", projectUrl, undefined, options);
  return project;
}

// Fetch a project and write it to disk
export async function write_site_by_project_id(
  params: { projectId: string; targetDir: string },
  options?: RequestOptions
): Promise<{ project: SitepaigeProject; wroteTo: string }> {
  const project = await fetch_project_by_id(params.projectId, options);
  
  try {
    const { writeProjectFromBlueprint } = await import("./blueprintWriter.js");
    await writeProjectFromBlueprint(project as any, { targetDir: params.targetDir });
  } catch (error) {
    console.error(`[write_site_by_project_id] ERROR in writeProjectFromBlueprint:`, error);
    throw error;
  }
  return { project, wroteTo: params.targetDir };
}