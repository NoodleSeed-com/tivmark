import { describe, expect, it } from 'vitest';
import app from '../src/server.js';

describe('tivmark-assistant', () => {
  it('exports a Noodle server definition', () => {
    expect(typeof app.toManifest).toBe('function');
  });
});
