// Read-only reproduction of the failing deploy preflight, via the CLI's own code path.
// Compiles src/server.ts exactly as `noodle deploy` would; never prints the token.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { preflightHostedDeploy } from './node_modules/@noodleseed/one/dist/commands/deploy-preflight.js';

const config = JSON.parse(readFileSync(`${homedir()}/.noodle/config.json`, 'utf8'));
const started = Date.now();
try {
  const result = await preflightHostedDeploy({
    manifestPath: 'src/server.ts',
    serviceUrl: 'https://cloud.noodleseed.dev',
    token: config.authToken,
    target: { org: 'noodleseed', app: 'tivmark-assistant', env: 'prod' },
    accessMode: 'customers',
    serverVersion: '19',
  });
  console.log(`OK ms=${Date.now() - started} ready=${result.response.ready}`);
  console.log(JSON.stringify(result.response.errors ?? [], null, 1).slice(0, 1500));
} catch (error) {
  console.log(`FAILED ms=${Date.now() - started} name=${error.name}`);
  console.log(String(error.message).slice(0, 600));
  if (error.status !== undefined) console.log(`status=${error.status}`);
}
