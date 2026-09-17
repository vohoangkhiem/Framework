/**
 * Installs Husky git hooks. Runs automatically via the `prepare` lifecycle script.
 *
 * The install is skipped (without failing `npm install`) when:
 *  - running in CI (hooks are pointless there and Husky would print noise), or
 *  - HUSKY=0 is set, or
 *  - the project is not (yet) a git repository.
 */
const { existsSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const isCi = process.env.CI === 'true' || process.env.CI === '1';
if (isCi || process.env.HUSKY === '0') {
  console.log('[hooks] Skipping Husky install (CI or HUSKY=0).');
  process.exit(0);
}

const gitDir = path.resolve(__dirname, '..', '.git');
if (!existsSync(gitDir)) {
  console.log(
    '[hooks] No .git directory found; skipping Husky install. Run "git init && npm run prepare" to enable hooks.'
  );
  process.exit(0);
}

try {
  execSync('npx husky', { stdio: 'inherit' });
  console.log('[hooks] Husky hooks installed.');
} catch (error) {
  console.warn(`[hooks] Husky install failed: ${error.message}`);
}
