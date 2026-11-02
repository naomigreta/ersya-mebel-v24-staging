#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function resolveDeployContext(env = process.env) {
  const value = String(env.CONTEXT || 'local').trim();
  return value || 'local';
}
function sourceFor(context) {
  return `'use strict';\n// Generated during Netlify build. Do not edit by hand.\nmodule.exports = ${JSON.stringify(String(context || 'local'))};\n`;
}
function writeContextFile(outputPath = path.join(__dirname, '..', 'netlify', 'deploy-context.js'), env = process.env) {
  const context = resolveDeployContext(env);
  fs.writeFileSync(outputPath, sourceFor(context), 'utf8');
  return context;
}
if (require.main === module) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  const context = writeContextFile(out);
  console.log(`Netlify deploy context stamped: ${context}`);
}
module.exports = { resolveDeployContext, sourceFor, writeContextFile };
