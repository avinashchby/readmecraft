export { analyzeProject } from './analyzer';
export { renderReadme } from './generators/renderer';
export { updateReadme } from './generators/updater';
export { generateBadges, renderBadges } from './generators/badges';
export type {
  AnalysisResult,
  ProjectInfo,
  Badge,
  TechStackEntry,
  ScriptEntry,
  ApiEntry,
  EnvVar,
  ReadmeStyle,
  CliOptions,
  ProjectType,
  PackageManager,
  ReadmeSection,
} from './types';
