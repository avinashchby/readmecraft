#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { analyzeProject } from './analyzer';
import { generateBadges } from './generators/badges';
import { renderBadges } from './generators/badges';
import { renderReadme } from './generators/renderer';
import { updateReadme } from './generators/updater';
import { ReadmeStyle } from './types';

const program = new Command();

program
  .name('readmecraft')
  .description('Auto-generate beautiful README.md files by analyzing your codebase')
  .version('0.1.0')
  .option('--preview', 'Print to stdout instead of writing file', false)
  .option('--style <style>', 'README style: minimal or detailed', 'detailed')
  .option('--badges', 'Only generate the badge section', false)
  .option('--update', 'Update existing README preserving custom sections', false)
  .option('-o, --output <path>', 'Output file path', 'README.md')
  .argument('[dir]', 'Project directory to analyze', '.')
  .action(async (dir: string, opts) => {
    try {
      const rootDir = path.resolve(dir);
      const outputPath = path.resolve(rootDir, opts.output);
      const style: ReadmeStyle = opts.style === 'minimal' ? 'minimal' : 'detailed';

      process.stderr.write(`Analyzing ${rootDir}...\n`);

      const analysis = await analyzeProject(rootDir);
      analysis.badges = generateBadges(analysis.projectInfo);

      if (opts.badges) {
        const badgeMarkdown = renderBadges(analysis.badges);
        process.stdout.write(badgeMarkdown + '\n');
        return;
      }

      const readme = renderReadme(analysis, style);

      if (opts.update) {
        let existing = '';
        try {
          existing = await fs.readFile(outputPath, 'utf-8');
        } catch {
          // No existing file — just write the new one
        }

        if (existing) {
          const updated = updateReadme(existing, readme);
          if (opts.preview) {
            process.stdout.write(updated);
          } else {
            await fs.writeFile(outputPath, updated, 'utf-8');
            process.stderr.write(`Updated ${outputPath}\n`);
          }
          return;
        }
      }

      if (opts.preview) {
        process.stdout.write(readme);
      } else {
        await fs.writeFile(outputPath, readme, 'utf-8');
        process.stderr.write(`Generated ${outputPath}\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program.parse();
