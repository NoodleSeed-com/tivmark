import { describe, expect, it } from 'vitest';
import app from '../src/server.js';
import { enterpriseCommand } from '../src/enterprise-contracts.js';

describe('enterprise onboarding contract', () => {
  it('separates safe reads, confirmed writes, and externally billed research', async () => {
    const manifest = await app.toManifest();
    const read = manifest.tools.find(
      (t) => t.name === 'enterprise_onboarding'
    )!;
    const write = manifest.tools.find(
      (t) => t.name === 'manage_enterprise_onboarding'
    )!;
    const research = manifest.tools.find(
      (t) => t.name === 'research_onboarding_company'
    )!;
    expect(read.annotations?.readOnlyHint).toBe(true);
    expect(write.annotations?.confirm).toBe(true);
    expect(research.annotations?.confirm).toBe(true);
    expect(research.annotations?.openWorldHint).toBe(true);
    for (const tool of [read, write, research]) {
      expect(tool.outputSchema?.required).toContain('workspace');
      expect(tool.outputSchema?.properties?.workspace).toMatchObject({
        required: expect.arrayContaining([
          'version',
          'steps',
          'boundary',
          'research',
          'url',
        ]),
      });
    }
  });
  it('cannot hide a research start inside the ordinary plan-change tool', () => {
    expect(
      enterpriseCommand.safeParse({ action: 'start-research', version: 1 })
        .success
    ).toBe(false);
    expect(
      enterpriseCommand.parse({ action: 'create', version: 0 }).source
    ).toBe('assistant');
  });
  it('declares a focused workflow without changing the assistant model provider', async () => {
    const manifest = await app.toManifest();
    expect(JSON.stringify(manifest)).toContain('enterprise_readiness');
    expect(JSON.stringify(manifest)).toContain('ASSISTANT_MODEL_BASE_URL');
  });
});
