// Capture the compiled deploy input + raw 503 response. Never prints the token.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { readDeployInput } from './node_modules/@noodleseed/one/dist/deploy.js';

const outDir = process.argv[2];
const authored = await readDeployInput('src/server.ts');
writeFileSync(`${outDir}/tivmark-manifest.json`, authored.manifest);
if (authored.connectors !== undefined)
  writeFileSync(`${outDir}/tivmark-connectors.yaml`, authored.connectors);
console.log(
  `manifest bytes=${authored.manifest.length} connectors=${authored.connectors !== undefined}`,
);

const config = JSON.parse(readFileSync(`${homedir()}/.noodle/config.json`, 'utf8'));
const body = JSON.stringify({
  manifest: authored.manifest,
  ...(authored.connectors !== undefined ? { connectors: authored.connectors } : {}),
  accessMode: 'customers',
  serverVersion: '19',
  deploymentSource: 'cli',
});
writeFileSync(`${outDir}/tivmark-preflight-body.json`, body);
const started = Date.now();
const res = await fetch(
  'https://cloud.noodleseed.dev/v1/orgs/noodleseed/apps/tivmark-assistant/envs/prod/deploy/preflight',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.authToken}` },
    body,
  },
);
const text = await res.text();
console.log(`status=${res.status} ms=${Date.now() - started}`);
console.log('headers:', JSON.stringify(Object.fromEntries(res.headers.entries())));
console.log('body:', text.slice(0, 500));
