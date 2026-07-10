import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { format } from 'prettier';

import { getOpenApiDocument } from '../lib/api/openapi';

const main = async () => {
  const outputPath = resolve(process.cwd(), 'openapi.generated.json');
  const generated = await format(JSON.stringify(getOpenApiDocument()), {
    parser: 'json',
  });

  if (process.argv.includes('--check')) {
    const current = existsSync(outputPath)
      ? readFileSync(outputPath, 'utf8')
      : '';
    if (current !== generated) {
      throw new Error(
        'openapi.generated.json is stale. Run npm run openapi:generate.'
      );
    }
  } else {
    writeFileSync(outputPath, generated, 'utf8');
  }
};

void main();
