/** Supported project types for detection. */
export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown';

/** Supported package managers. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'uv' | 'poetry' | 'cargo' | 'go';

/** README generation style. */
export type ReadmeStyle = 'minimal' | 'detailed';

/** CLI options passed from Commander.js. */
export interface CliOptions {
  preview: boolean;
  style: ReadmeStyle;
  badges: boolean;
  update: boolean;
  output: string;
}

/** Project metadata extracted from manifest files. */
export interface ProjectInfo {
  name: string;
  description: string;
  version: string;
  license: string;
  author: string;
  repository: string;
  homepage: string;
  projectType: ProjectType;
  packageManager: PackageManager;
}

/** A single badge definition. */
export interface Badge {
  label: string;
  url: string;
}

/** Tech stack entry. */
export interface TechStackEntry {
  category: string;
  technology: string;
  version?: string;
}

/** A script/command from the project. */
export interface ScriptEntry {
  name: string;
  command: string;
  description: string;
}

/** An exported function or API entry. */
export interface ApiEntry {
  name: string;
  file: string;
  signature: string;
  description: string;
}

/** Environment variable reference. */
export interface EnvVar {
  name: string;
  source: string;
  defaultValue?: string;
  description?: string;
}

/** Aggregated analysis result from all detectors. */
export interface AnalysisResult {
  projectInfo: ProjectInfo;
  badges: Badge[];
  techStack: TechStackEntry[];
  installation: string;
  usage: string;
  apiDocs: ApiEntry[];
  projectTree: string;
  envVars: EnvVar[];
  scripts: ScriptEntry[];
  hasDocker: boolean;
  dockerSetup: string;
  hasCiCd: boolean;
  ciCdInfo: string;
  contributing: string;
  licenseSection: string;
}

/** Section in a README that can be auto-generated or custom. */
export interface ReadmeSection {
  id: string;
  title: string;
  content: string;
  isCustom: boolean;
}
