/**
 * Merges Playwright blob reports produced by sharded CI runs into a single set of
 * HTML / JUnit / JSON reports.
 *
 * Usage:
 *   node scripts/merge-reports.js [blobDir=blob-report] [outputDir=playwright-report]
 *
 * Each CI shard must run with the `blob` reporter (enabled automatically when CI=true)
 * and upload its `blob-report/` directory; the CI job downloads all of them into one
 * folder before invoking this script.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const blobDir = path.resolve(process.argv[2] ?? 'blob-report');
const outputDir = path.resolve(process.argv[3] ?? 'playwright-report');

if (!fs.existsSync(blobDir)) {
  console.error(`[merge-reports] Blob directory not found: ${blobDir}`);
  process.exit(1);
}

const blobs = fs.readdirSync(blobDir).filter(file => file.endsWith('.zip'));
if (blobs.length === 0) {
  console.error(`[merge-reports] No *.zip blob reports found in ${blobDir}`);
  process.exit(1);
}
console.log(`[merge-reports] Merging ${blobs.length} blob report(s) from ${blobDir}`);

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', 'merge-reports', '--reporter', 'html,junit,json', blobDir],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      PLAYWRIGHT_HTML_OUTPUT_DIR: outputDir,
      PLAYWRIGHT_HTML_REPORT: outputDir,
      PLAYWRIGHT_HTML_OPEN: 'never',
      PLAYWRIGHT_JUNIT_OUTPUT_NAME: path.join('test-results', 'junit.xml'),
      PLAYWRIGHT_JSON_OUTPUT_NAME: path.join('test-results', 'results.json'),
    },
  }
);

process.exit(result.status ?? 1);
