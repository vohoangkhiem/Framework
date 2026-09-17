/**
 * Removes generated test artifacts before a run so that reports never mix results
 * from different executions. Safe to run when the directories do not exist.
 *
 * Honours OUTPUT_DIR (from the environment or .env) so a relocated artifact folder is
 * cleaned as well.
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env'), quiet: true });

const outputDir = path.resolve(rootDir, process.env.OUTPUT_DIR || 'test-results');
const dirsToClean = [
  ...new Set([
    outputDir,
    path.join(rootDir, 'test-results'),
    path.join(rootDir, 'playwright-report'),
    path.join(rootDir, 'blob-report'),
  ]),
];

for (const dirPath of dirsToClean) {
  if (!fs.existsSync(dirPath)) {
    continue;
  }
  try {
    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log(`[clean] removed ${path.relative(rootDir, dirPath) || dirPath}`);
  } catch (error) {
    console.warn(`[clean] warning: could not remove ${dirPath}: ${error.message}`);
  }
}
