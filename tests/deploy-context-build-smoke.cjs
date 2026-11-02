const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const script = path.resolve(__dirname, '../scripts/inject-deploy-context.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ersya-context-test-'));
try {
  const productionFile = path.join(dir, 'production.js');
  execFileSync(process.execPath, [script, productionFile], { env: { ...process.env, CONTEXT: 'production' } });
  assert.equal(require(productionFile), 'production', 'Netlify production build context must be embedded for serverless runtime');

  const previewFile = path.join(dir, 'preview.js');
  execFileSync(process.execPath, [script, previewFile], { env: { ...process.env, CONTEXT: 'deploy-preview' } });
  assert.equal(require(previewFile), 'deploy-preview', 'Netlify Deploy Preview context must be embedded for serverless runtime');

  const branchFile = path.join(dir, 'branch.js');
  execFileSync(process.execPath, [script, branchFile], { env: { ...process.env, CONTEXT: 'staging' } });
  assert.equal(require(branchFile), 'staging', 'custom branch contexts must remain non-production');
  console.log('Deploy context build smoke tests passed: production, deploy-preview, and custom branch contexts are embedded for function runtime.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
