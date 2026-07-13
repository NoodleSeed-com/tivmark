import { readFileSync } from 'fs';
import { resolve } from 'path';

const sourceFiles = process.argv.slice(2);
const violations: string[] = [];
const allowedInternal = [
  '/api/auth/',
  '/api/oauth/',
  '/api/oauth-v1/',
  '/api/webhooks/',
  '/api/scim/',
  '/api/health',
  '/api/openapi.json',
  '/api/invitations/',
  '/api/assistant/',
];

for (const file of sourceFiles) {
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  for (const match of Array.from(source.matchAll(/['"`]\/api\/[^'"`$?]*/g))) {
    const endpoint = match[0].slice(1);
    if (
      endpoint.startsWith('/api/v1/') ||
      allowedInternal.some((prefix) => endpoint.startsWith(prefix))
    ) {
      continue;
    }
    violations.push(`${file}: ${endpoint}`);
  }
}

if (violations.length) {
  throw new Error(
    `UI code must consume the public v1 API:\n${violations.join('\n')}`
  );
}
