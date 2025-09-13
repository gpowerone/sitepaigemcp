export type OverwriteMode = "fail" | "skip" | "backup" | "overwrite";

export interface GenerateSiteInput {
  prompt: string;
  targetDir: string;
}

// -------- Blueprint types --------
export interface Blueprint {
    models: Array<Model>;
    views: Array<View>;
    pages: Array<Page>;
    menus: Array<Menu>;
    apis: Array<Api>;
    objects: Array<ObjectDefinition>; // New: Object definitions for APIs
    sample_data?: Array<{tableName: string, sql: string}>; // NEW: SQL statements for sample data
    secrets?: Array<{
        name: string;      // User-friendly secret name (e.g., "OPENAI_API_KEY")
        awsId: string;     // AWS Secrets Manager ID (e.g., "OPENAI_API_KEY__uuid__uuid")
        isTest: boolean;   // Whether this is a test or production secret
    }>;
    thirdPartyApis?: Array<ThirdPartyApi>; // NEW: List of third-party APIs/integrations
    design: Design;
    hierarchy: Array<HierarchyNode>;
    er_diagram: Array<ErDiagram>;
    dictionary: { [key: string]: string };
    header_free: boolean | null; 
    footer_free: boolean | null;
    apiv2: boolean | null;
    generation_phase?: 'pages-first' | 'complete'; // NEW: Track generation phase
    migrations?: Array<Migration>; // NEW: Track database changes for incremental migrations
}

export interface Migration {
    id: string;
    timestamp: string; // UTC timestamp in ISO format
    modelId: string;
    modelName: string;
    action: 'create' | 'update' | 'delete';
    changes: {
        type: 'model' | 'field' | 'constraint';
        operation: 'add' | 'remove' | 'modify';
        field?: string;
        oldValue?: any;
        newValue?: any;
        details?: string;
    }[];
}

export interface ThirdPartyApi {
    id: string;
    name: string;              // e.g., "Google Analytics"
    version: string;           // e.g., "4"
    category: string;          // e.g., "analytics", "payment", "chat", "maps", "calendar", "crm"
    description: string;       // Brief description of what this integration does
    requiresSecret: boolean;   // Whether this integration requires API keys/secrets
    secretNames?: string[];    // Names of required secrets (e.g., ["GOOGLE_ANALYTICS_ID"])
    enabled: boolean;          // Whether to include this integration
    usageType?: string;        // "frontend", "backend", or "both"
    requiredFor?: string;      // Brief explanation of what features require this API
}

export interface Design {
    generatelogo: boolean;
    generatefavicon: boolean;
    logo: string;
    favicon: string;
    logoPosition: string;
    menuPosition: string;
    hideMenuOnDesktop: boolean;
    ctaPosition: string;
    loginPosition: string;
    heroLayout: string;
    bleedColorIntoHeader: boolean;
    titleColor: string;
    textColor: string;
    accentColor: string;
    backgroundColor: string;
    accentTextColor: string;
    useGradient: boolean;
    gradientColor: string;
    titleFont: string;
    textFont: string;
    logoFont: string;
    ideaCloud: string[];
    designStyle: string;
    colorScheme: string;
    targetLocation: string;
    websiteLanguage: string;
    buttonRoundedness: string;
    titleFontSize: string;
    textFontSize: string;
    menuFont: string;
    menuFontSize: string;
    authenticationType?: string;
}

export interface ErDiagram {
    model_id: string;
    relationships: Array<ErDiagramRelationship>;
}

export interface ErDiagramRelationship {
    to: string;
    propA: string;
    propB: string;
    type: string;
}
        
export interface PageView {
  id: string;
  rowpos: number;
  colpos: number;
  colposmd: number;
  colpossm: number;
  untouchable: boolean;
}

export interface View {
    id: string;
    name: string;
    type: string;
    untouchable: boolean;
    background_image: string;
    background_color: string | null;
    text_color: string;
    card_title_color?: string | null;
    custom_view_description: string;
    prompt: string | null;
    paddingLeft: number | null;
    paddingRight: number | null;
    paddingTop: number | null;
    paddingBottom: number | null;
    marginLeft: number | null;
    marginRight: number | null;
    marginTop: number | null;
    marginBottom: number | null;
    minHeight: number | null;
    minWidth: number | null;
    maxHeight: number | null;
    maxWidth: number | null;
    flowVertical: boolean | null;
    align: string | null;
    verticalAlign: string | null;
    // Cache busting for background images
    background_image_updated?: number;
    // Background image dimensions
    background_image_width?: number;
    background_image_height?: number;
    // Complex component specific fields
    subComponents: SubComponent[];
    // Link type and external URL support for buttons
    link_type: 'page' | 'external';
    external_url: string | null;
    // APIs that this view should use
    apis: string[];
}

export interface SubComponent {
    id: string;
    name: string;
    prompt: string;
    functionName: string;
}

export const viewTypes = [
  { value: 'contact', label: 'Contact', useapi:false, hasauthoption:null, sectiontype: 'internal'},
  { value: 'image', label: 'Image Section', disabled: false, sectiontype: 'commoncontent' },
  { value: 'container', label: 'Container', disabled: false, hasauthoption:null, sectiontype: 'commoncontent' },
  { value: 'component', label: 'Code Section', disabled: false, sectiontype: 'commoncontent' },
  { value: 'generatedcomponent', label: 'Code Section Prompt', sectiontype: 'prompt' },
  { value: 'complexcomponent', label: 'Complex Code Section', disabled: false, sectiontype: 'commoncontent' },
  { value: 'generatedcomplexcomponent', label: 'Complex Code Section Prompt', sectiontype: 'prompt' },
  { value: 'generatedimage', label: 'Image Section Prompt', sectiontype: 'prompt' },
  { value: 'button', label: 'Button', disabled: false, sectiontype: 'commoncontent' },
  { value: 'menu', label: 'Menu', hasauthoption:null, sectiontype: 'commoncontent' },
  { value: 'text', label: 'Text Section', disabled: false, sectiontype: 'commoncontent' },
  { value: 'profile', label: 'Profile', hasauthoption:null, sectiontype: 'internal' },
  { value: 'login', label: 'Login', hasauthoption:false, sectiontype: 'internal' },
  { value: 'loginbutton', label: 'Login Button', hasauthoption:false, sectiontype: 'commoncontent' },
  { value: 'headerlogin', label: 'Header Login', hasauthoption:false, sectiontype: 'internal' },
  { value: 'ctabutton', label: 'Call To Action Button', hasauthoption:false, sectiontype: 'commoncontent' },
  { value: 'logo', label: 'Logo', hasauthoption:false, sectiontype: 'commoncontent' },
  { value: 'pricing', label: 'Pricing', hasauthoption:false, sectiontype: 'internal' },
  { value: 'integration', label: 'Integration Section', disabled: false, sectiontype: 'commoncontent' },
  { value: 'generatedintegration', label: 'Integration Prompt', sectiontype: 'prompt' },
  { value: 'logincallback', label: 'Login Callback', hasauthoption:false, sectiontype: 'internal' },
  { value: 'youtubevideo', label: 'Youtube Video', hasauthoption:null, sectiontype: 'commoncontent' },
  { value: 'iconbar', label: 'Icon Bar', hasauthoption:null, sectiontype: 'commoncontent' },
  { value: 'useradmin', label: 'User Admin', hasauthoption:false, sectiontype: 'internal' },
  { value: 'loggedinmenu', label: 'Logged In Menu', hasauthoption:false, sectiontype: 'internal' },
  { value: 'adminmenu', label: 'Admin Menu', hasauthoption:false, sectiontype: 'internal' }
];

// Legacy interface - kept for migration compatibility
export interface ApiParameter {
    name: string;
    type: string; // e.g., 'string', 'number', 'boolean', 'object', 'array'
    required: boolean;
    description?: string;
    constraints?: string[]; // Validation constraints for frontend/backend consistency
    // Additional fields for detailed interface formatting
    object_id?: string; // For object types, reference to ObjectDefinition
    array_item_type?: string; // For arrays, the type of items in the array
    array_item_object_id?: string; // For arrays of objects, reference to ObjectDefinition
}

// New Object-based system
export interface ObjectProperty {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description?: string; // Optional description for the property
    object_id?: string; // Reference to another object if type is 'object'
    array_item_type?: 'string' | 'number' | 'boolean' | 'object'; // For arrays
    array_item_object_id?: string; // Reference to object type for array items
    constraints?: string[]; // Constraints for validation (e.g., ["min:0", "max:100"] for numbers, ["minLen:5", "maxLen:50"] for strings)
}

export interface ObjectDefinition {
    id: string;
    name: string; // e.g., "Product", "User", "Order"
    description?: string;
    properties: ObjectProperty[];
    created_from_migration?: boolean; // Track if this was auto-created during migration
}

export interface Api {
    id: string;
    name: string;
    requires_auth: string
    user_tier: string;
    state?: 'ungenerated' | 'generated'; // Track generation state for APIs
    prompt?: string; // Prompt for API generation
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'; // HTTP method
    
    // New object-based interface
    input_object_id?: string; // Reference to ObjectDefinition
    output_object_id?: string; // Reference to ObjectDefinition
    
    // Legacy - kept for migration compatibility
    input_interface?: ApiParameter[]; // Deprecated: use input_object_id instead
    output_interface?: ApiParameter[]; // Deprecated: use output_object_id instead
    
    apikeys: string[]; // Names of API keys required (not values)
    
    // Redirect flow support
    returnsRedirect: boolean; // If true, API returns a 301 redirect instead of JSON
    redirectCallbackPageId: string; // Page ID for redirect callback handling
}

// DEPRECATED: This interface will be removed in future versions
// Sample records are no longer generated during project creation
export interface SampleRecords {
    id: string;
    records: any[]; // The actual sample records (3 instances of the object)
    object_id?: string; // NEW: Object ID that these records represent
    associated_api_ids?: string[]; // LEGACY: API IDs that use these sample records (for migration)
}

export interface Menu {
  id: string;
  name: string;
  font: string;
  fontSize: string;
  untouchable: boolean;
  direction: string | null;
  items: Array<MenuItem>;
  useIcons?: boolean; // New field to indicate icon mode
}

export interface MenuItem {
  id: string;
  name: string;
  page: string | null;
  menu: string | null;
  untouchable: boolean;
  link_type?: 'page' | 'external'; // New field to distinguish between internal pages and external URLs
  external_url?: string | null; // New field for external URLs
  iconType?: 'cart' | 'search' | 'user' | 'home' | 'settings' | 'bell' | 'menu'; // New field for icon type
  hiddenOnDesktop?: boolean; // New field to hide item on desktop (shows in icon bar instead)
}

export interface HierarchyNode {
  id: string;
  lookup_name: string;
  graphrender: boolean;
  children: Array<HierarchyNode>;
}

export interface Page {
  id: string;
  name: string;
  description: string;
  access: string;
  linked_from: string;
  untouchable: boolean;
  is_home: boolean;
  user_tier: string;
  views: Array<PageView>;
  redirectForApiId?: string; // If set, this page handles redirect callbacks for the specified API
}

export interface Model {
    id: string;
    name: string;
    data_is_user_specific: string;
    state: 'ephemeral' | 'persistent';
    dependencies: string[];
    addAuthRequired: string;
    getAuthRequired: string;
    deleteAuthRequired: string;
    updateAuthRequired: string;
    has_db_crud: string;
    fields: ModelField[];
}

export interface ModelField {
    name: string;
    datatype: string;
    datatypesize: string;
    is_image:string;
    is_file:string;
    untouchable: string;
    required: string;
    is_searchable: string;
    key: string;
}

export interface ProjectData {
    models: Model[];
    views: View[];
    pages: Page[];
    menus: Menu[];
    apis: Api[];
    objects?: ObjectDefinition[]; // NEW: Object definitions for APIs
    sample_data?: Array<{tableName: string, sql: string}>; // NEW: SQL statements for sample data
    secrets?: Array<{
        name: string;      // User-friendly secret name (e.g., "OPENAI_API_KEY")
        awsId: string;     // AWS Secrets Manager ID (e.g., "OPENAI_API_KEY__uuid__uuid")
        isTest: boolean;   // Whether this is a test or production secret
    }>;
    thirdPartyApis?: ThirdPartyApi[]; // NEW: List of third-party APIs/integrations
    design: Design;
    hierarchy: HierarchyNode[];
    er_diagram: any[];
    userTiers?: any[];
    systems: string[];
    header_font: string
    generateLogo: boolean;
    requiresPayment?: boolean;
    header_free: boolean;
    footer_free: boolean;
    dictionary: { [key: string]: string };
    apiv2?: boolean; // Indicates if project uses the new API v2 structure
    objectsv1?: boolean; // Indicates if project uses the old API v1 structure
    migrations?: Migration[]; // NEW: Track database changes for incremental migrations
}

export interface Code {
  apis: Array<{
    id: string;
    apis: Array<{
      id: string;
      type: string;
      code: string;
    }>;
  }>;
  views: Array<{
    viewID: string;
    code: string;
  }>;
}

export interface UserTier {
    name: string;
    paid: boolean;
    description: string;
    monthly_price: number;
    yearly_price: number;
  }

export interface AuthProviders {
    google: boolean;
    facebook: boolean;
    github: boolean;
    apple: boolean;
  }
  
export function getDesign(blueprint: Blueprint): Design {
  const defaultDesign: Design = {
    generatelogo: true,
    generatefavicon: true,
    logo: '',
    favicon: '',
    logoPosition: 'left',
    menuPosition: 'right',
    menuFont: 'Roboto',
    menuFontSize: 'text-lg',
    hideMenuOnDesktop: false,
    ctaPosition: 'none',
    loginPosition: 'none',
    heroLayout: 'two-columns-right',
    bleedColorIntoHeader: true,
    titleColor: '#000000',
    textColor: '#333333',
    accentColor: '#516ab8',
    backgroundColor: '#ffffff',
    colorScheme: 'Ocean Blue',
    accentTextColor: '#ffffff',
    useGradient: true,
    gradientColor: '#f0f0f0',
    titleFont: 'Roboto',
    textFont: 'Roboto',
    logoFont: 'Roboto',
    ideaCloud: [],
    designStyle: 'hero-banner',
    targetLocation: 'Worldwide',
    websiteLanguage: 'English',
    buttonRoundedness: 'rounded',
    titleFontSize: 'text-3xl',
    textFontSize: 'text-base'
  };

  if (!blueprint.design) {
    return defaultDesign;
  }

  return {
    generatelogo: blueprint.design.generatelogo ?? defaultDesign.generatelogo,
    generatefavicon: blueprint.design.generatefavicon ?? defaultDesign.generatefavicon,
    logo: blueprint.design.logo ?? defaultDesign.logo,
    favicon: blueprint.design.favicon ?? defaultDesign.favicon,
    logoPosition: blueprint.design.logoPosition ?? defaultDesign.logoPosition,
    menuPosition: blueprint.design.menuPosition ?? defaultDesign.menuPosition,
    hideMenuOnDesktop: blueprint.design.hideMenuOnDesktop ?? defaultDesign.hideMenuOnDesktop,
    ctaPosition: blueprint.design.ctaPosition ?? defaultDesign.ctaPosition,
    loginPosition: blueprint.design.loginPosition ?? defaultDesign.loginPosition,
    heroLayout: blueprint.design.heroLayout ?? defaultDesign.heroLayout,
    bleedColorIntoHeader: blueprint.design.bleedColorIntoHeader ?? defaultDesign.bleedColorIntoHeader,
    titleColor: blueprint.design.titleColor ?? defaultDesign.titleColor,
    textColor: blueprint.design.textColor ?? defaultDesign.textColor,
    accentColor: blueprint.design.accentColor ?? defaultDesign.accentColor,
    backgroundColor: blueprint.design.backgroundColor ?? defaultDesign.backgroundColor,
    colorScheme: blueprint.design.colorScheme ?? defaultDesign.colorScheme,
    accentTextColor: blueprint.design.accentTextColor ?? defaultDesign.accentTextColor,
    useGradient: blueprint.design.useGradient ?? defaultDesign.useGradient,
    gradientColor: blueprint.design.gradientColor ?? defaultDesign.gradientColor,
    titleFont: blueprint.design.titleFont ?? defaultDesign.titleFont,
    textFont: blueprint.design.textFont ?? defaultDesign.textFont,
    logoFont: blueprint.design.logoFont ?? defaultDesign.logoFont,
    ideaCloud: blueprint.design.ideaCloud ?? defaultDesign.ideaCloud,
    designStyle: blueprint.design.designStyle ?? defaultDesign.designStyle,
    targetLocation: blueprint.design.targetLocation ?? defaultDesign.targetLocation,
    websiteLanguage: blueprint.design.websiteLanguage ?? defaultDesign.websiteLanguage,
    buttonRoundedness: blueprint.design.buttonRoundedness ?? defaultDesign.buttonRoundedness,
    titleFontSize: blueprint.design.titleFontSize ?? defaultDesign.titleFontSize,
    textFontSize: blueprint.design.textFontSize ?? defaultDesign.textFontSize,
    menuFont: blueprint.design.menuFont ?? defaultDesign.menuFont,
    menuFontSize: blueprint.design.menuFontSize ?? defaultDesign.menuFontSize
  };
}

export interface ManifestEntry {
  path: string;
  mode: "file" | "dir";
  size?: number;
  hash?: string;
}

export interface BundleFile {
  path: string;
  contentsBase64: string;
  hash?: string;
}

export interface RemoteGenerateResponse {
  plan?: string;
  manifest: ManifestEntry[];
  files: BundleFile[];
}

export interface JobStatus {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  step?: string;
  progressPercent?: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  expectedDurationSeconds?: number;  // Expected total duration in seconds
  recommendedPollingIntervalSeconds?: number;  // Recommended interval between polls
}

export interface JobResultSummary {
  created: string[];
  updated: string[];
  skipped: string[];
  conflicts: string[];
  backups: string[];
}

export interface Job {
  id: string;
  status: JobStatus;
  logs: string[];
  plan?: string;
  result?: JobResultSummary;
  projectId?: string;
  targetDir?: string;
  databaseType?: "sqlite" | "postgres" | "mysql";
}

export interface ResourceDescriptor {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

// -------- Sitepaige API integration types --------
export interface SitepaigeJobsRequestBody {
  projectName: string;
  ideaText: string;
  baasProvider?: string | null;
  authProviders?: Record<string, unknown> | null;
  userTiers?: Record<string, unknown> | unknown[] | null;
  paymentProcessor?: string | null;
  requiresAuth: boolean;
  relationalDatabase?: string | null;
  objectDatabase?: string | null;
  colorScheme?: string | null;
  designStyle?: string | null;
  targetLocation?: string | null;
  websiteLanguage?: string | null;
  generateLogo?: boolean | null;
  analytics?: Record<string, unknown> | null;
  requirements?: Record<string, unknown> | null;
}

export interface SitepaigeJobsResponseBody {
  success: boolean;
  projectId: string; // UUID
  mode: string; // 'pages-first'
}

export interface SitepaigePagesFirstBody {
  projectId: string; // UUID
  designStyle?: string;
  colorScheme?: string;
  targetLocation?: string;
  websiteLanguage?: string;
  requiresAuth?: boolean;
}

export interface SitepaigePagesFirstResponse {
  success: boolean;
  blueprint?: Record<string, unknown>;
  explanation?: string;
}

export interface SitepaigeCompleteGenerationBody {
  projectId: string; // UUID
}

export interface SitepaigeCompleteGenerationResponse {
  success: boolean;
  redirectUrl?: string;
  stats?: {
    viewsGenerated: number;
    apisGenerated: number;
  };
}

export interface SitepaigeProjectQuery {
  id: string; // UUID
  historyId?: string;
}

export type SitepaigeProject = Record<string, unknown> & {
  code?: Record<string, unknown>;
  blueprint?: Record<string, unknown>;
  hasHosting?: boolean;
};

export interface GenerateSiteParams {
  projectName: string;
  requirements: string;
  designStyle?: string;
  colorScheme?: string;
  targetLocation?: string;
  websiteLanguage?: string;
  requiresAuth?: boolean; // default true
  databaseType?: "sqlite" | "postgres" | "mysql";
  login_providers?: string; // default 'google'
}

export interface GenerateSiteResult {
  projectId: string;
  mode: string;
  project: SitepaigeProject;
  tbd: string;
}

