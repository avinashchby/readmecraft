import { AnalysisResult, ProjectInfo } from './types';
import { detectProjectInfo } from './detectors/project-info';
import { detectTechStack } from './detectors/tech-stack';
import { detectInstallation } from './detectors/installation';
import { detectUsage } from './detectors/usage';
import { detectApiDocs } from './detectors/api-docs';
import { detectProjectTree } from './detectors/project-tree';
import { detectEnvVars } from './detectors/env-vars';
import { detectScripts } from './detectors/scripts';
import { detectDocker } from './detectors/docker';
import { detectCiCd } from './detectors/ci-cd';
import { generateContributing, generateLicense } from './generators/sections';

/** Run all detectors against a project root and return aggregated results. */
export async function analyzeProject(rootDir: string): Promise<AnalysisResult> {
  const projectInfo = await detectProjectInfo(rootDir);

  const [
    techStack,
    installation,
    usage,
    apiDocs,
    projectTree,
    envVars,
    scripts,
    dockerResult,
    ciCdResult,
  ] = await Promise.all([
    detectTechStack(rootDir),
    detectInstallation(rootDir, projectInfo),
    detectUsage(rootDir, projectInfo),
    detectApiDocs(rootDir, projectInfo.projectType),
    detectProjectTree(rootDir),
    detectEnvVars(rootDir),
    detectScripts(rootDir),
    detectDocker(rootDir),
    detectCiCd(rootDir),
  ]);

  return {
    projectInfo,
    badges: [],
    techStack,
    installation,
    usage,
    apiDocs,
    projectTree,
    envVars,
    scripts,
    hasDocker: dockerResult.hasDocker,
    dockerSetup: dockerResult.dockerSetup,
    hasCiCd: ciCdResult.hasCiCd,
    ciCdInfo: ciCdResult.ciCdInfo,
    contributing: generateContributing(projectInfo),
    licenseSection: generateLicense(projectInfo),
  };
}
