/**
 * Core types for media generation
 */

// --- Media Types ---

export type MediaType = "event-flyer" | "print-menu" | "social-post";

export type FlyerStyle = "vibrant" | "minimal" | "retro" | "neon";

// --- Format Config ---

export interface FormatConfig {
  name: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  dpi: number;
  category: "social" | "print";
  /** Bleed in pixels (print only) */
  bleed?: number;
  /** Safe margin in pixels (print only) */
  safeMargin?: number;
}

// --- Brand Types ---

export interface BrandLogo {
  id: string;
  path: string;
  resolvedPath?: string;
  type: "primary" | "secondary" | "mascot" | "icon";
  use_on?: "light" | "dark" | "any";
}

export interface BrandAsset {
  id: string;
  path: string;
  resolvedPath?: string;
  type: "background" | "texture" | "watermark" | "decoration";
  description?: string;
}

export interface BrandProfile {
  id: string;
  name: string;
  tagline: string;
  venue: {
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
    hours_note?: string;
  };
  social: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    website?: string;
  };
  colors: {
    primary: string;
    dark: string;
    accent: string;
    light: string;
    secondary: string;
    [key: string]: string;
  };
  typography: {
    heading: string;
    body: string;
    accent: string;
    min_heading_size: number;
    min_body_size: number;
  };
  voice: {
    tone: string;
    personality: string;
    writing_style: string;
    sample_phrases: string[];
  };
  design_rules: {
    logo_clearspace: string;
    safe_margins: string;
    prohibited: string[];
    required: string[];
  };
  logos: BrandLogo[];
  additional_assets?: BrandAsset[];
}

// --- Content Types ---

export interface EventContent {
  eventName: string;
  date: string;
  time?: string;
  description?: string;
  tags?: string[];
  campaign?: string;
}

export interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export interface MenuContent {
  title: string;
  sections: MenuSection[];
  subtitle?: string;
  footer?: string;
  tags?: string[];
  campaign?: string;
}

export interface SocialContent {
  headline: string;
  body?: string;
  hashtags?: string[];
  tags?: string[];
  campaign?: string;
}

export type ContentData = EventContent | MenuContent | SocialContent;

// --- Provider Types ---

export interface ProviderRequest {
  prompt: string;
  images: ProviderImage[];
  outputConfig: {
    aspectRatio: string;
    quality?: string;
  };
}

export interface ProviderImage {
  data: Buffer;
  mimeType: string;
  role: "brand" | "content" | "template";
}

export interface ProviderResult {
  success: boolean;
  imageBuffer?: Buffer;
  error?: string;
  errorType?: "transient" | "rate_limit" | "auth" | "validation" | "budget";
  costCents?: number;
  model?: string;
}

export interface ImageProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

export interface CostEstimate {
  formatCount: number;
  costPerGeneration: number;
  maxRetries: number;
  bestCase: number;
  worstCase: number;
  withinBudget: boolean;
}

export interface ProviderRegistry {
  getProvider(preference?: string): ImageProvider;
  checkBudget(estimatedCostCents: number): boolean;
  getUsageToday(): { totalCents: number; callCount: number };
  estimateCost(formatCount: number): CostEstimate;
}

// --- Generation Request ---

export interface GenerationRequest {
  brandId: string;
  mediaType: MediaType;
  formats: string[];
  content: ContentData;
  style?: FlyerStyle;
  customPrompt?: string;
  images?: string[];
  parentId?: string;
  forceNew?: boolean;
  tags?: string[];
  campaign?: string;
  sides?: number;
  printReady?: boolean;
  /** Hex color for logo tinting, e.g. "#8B00FF" */
  logoColor?: string;
  /** Image provider override: "openai" | "gemini" */
  provider?: string;
  /** Image quality tier (OpenAI): "low" | "medium" | "high" */
  quality?: string;
  /** Use programmatic text rendering instead of AI-generated text */
  textOverlay?: boolean;
  /** Also export an editable PowerPoint file (requires textOverlay) */
  exportPptx?: boolean;
  /** Path to an existing image to edit (edit mode) */
  editSource?: string;
  /** Edit instructions describing what to change */
  editInstructions?: string;
}

// --- Metadata ---

export interface SourceInput {
  originalPath: string;
  originalName: string;
  contentHash: string;
  role: "brand" | "content" | "template";
}

export interface MediaRecord {
  schemaVersion: 1;
  id: string;
  jobId: string;
  brandId: string;
  mediaType: MediaType;
  format: string;

  parentId?: string;

  eventName?: string;
  eventDate?: string;
  campaign?: string;
  tags: string[];

  version: number;
  provider: string;
  providerModel: string;
  promptHash: string;
  sourceInputs: SourceInput[];
  generationSeed?: string;
  style?: string;
  customPrompt?: string;

  filePath: string;
  fileSize: number;
  contentHash: string;

  status: "generated" | "approved" | "rejected" | "archived";
  approvedBy?: string;
  generatedAt: string;
  approvedAt?: string;

  costCents?: number;
}

// --- Job Types ---

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "retrying";

export interface Job {
  id: string;
  idempotencyKey: string;
  status: JobStatus;
  request: GenerationRequest;
  results: JobResult[];
  attempts: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  warnings: string[];
}

export interface JobResult {
  format: string;
  success: boolean;
  mediaRecord?: MediaRecord;
  error?: string;
  warnings: string[];
  costCents?: number;
}

// --- Quality Gate ---

export type QualityCheckResult = "pass" | "warn" | "fail";

export interface QualityCheck {
  name: string;
  result: QualityCheckResult;
  message?: string;
}

export interface QualityReport {
  passed: boolean;
  checks: QualityCheck[];
  warnings: string[];
}
