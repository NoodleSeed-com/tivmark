import fs from 'node:fs';
import path from 'node:path';

import { ASSISTANT_APPEARANCE } from '../../lib/assistantAppearance';

type Palette = Record<string, string>;

const luminance = (hex: string) => {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (foreground: string, background: string) => {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
};

const expectTextContrast = (foreground: string, background: string) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
};

const expectBoundaryContrast = (foreground: string, background: string) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
};

const blockStartingAt = (source: string, selector: string) => {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex < 0) throw new Error(`Missing CSS selector: ${selector}`);

  const start = source.indexOf('{', selectorIndex);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }

  throw new Error(`Unclosed CSS selector: ${selector}`);
};

const variablesFrom = (block: string): Palette => {
  const variables: Palette = {};
  const matcher = /--([\w-]+):\s*(#[\da-f]{6})\s*;/gi;
  let match = matcher.exec(block);

  while (match) {
    variables[match[1]] = match[2].toLowerCase();
    match = matcher.exec(block);
  }

  return variables;
};

const publicSite = fs.readFileSync(
  path.resolve(__dirname, '../../../marketing/index.html'),
  'utf8'
);
const publicStyle = publicSite.slice(publicSite.indexOf('<style>'));
const publicLight = variablesFrom(blockStartingAt(publicStyle, ':root {'));
const publicDark = {
  ...publicLight,
  ...variablesFrom(
    blockStartingAt(publicStyle, '[data-theme="tivmark-dark"] {')
  ),
};

const widgetStyle = fs.readFileSync(
  path.resolve(__dirname, '../../../assistant/src/views/widget-style.css'),
  'utf8'
);
const widgetLight = variablesFrom(blockStartingAt(widgetStyle, ':root {'));
const widgetDark = {
  ...widgetLight,
  ...variablesFrom(blockStartingAt(widgetStyle, '.dark {')),
};

describe.each([
  ['light', ASSISTANT_APPEARANCE.light],
  ['dark', ASSISTANT_APPEARANCE.dark],
] as const)('embedded assistant %s theme', (_name, theme) => {
  it('keeps every text-bearing surface at WCAG AA contrast', () => {
    expectTextContrast(theme.text, theme.canvas);
    expectTextContrast(theme.mutedText, theme.canvas);
    expectTextContrast(theme.mutedText, theme.panel.surface);
    expectTextContrast(theme.link, theme.panel.surface);
    expectTextContrast(theme.success, theme.panel.surface);
    expectTextContrast(theme.warning, theme.panel.surface);
    expectTextContrast(theme.danger, theme.panel.surface);

    for (const role of [
      theme.panel,
      theme.header,
      theme.assistantMessage,
      theme.userMessage,
      theme.composer,
      theme.suggestion,
      theme.confirmation,
      theme.primaryButton,
      theme.secondaryButton,
      theme.launcher,
      theme.code,
      theme.app,
    ]) {
      expectTextContrast(role.text, role.surface);
      if ('border' in role && role.border) {
        expectBoundaryContrast(role.border, role.surface);
      }
    }

    // Noodle Seed 1.31 currently uses the global text role for the expanded launcher
    // input, so this pairing must pass independently of launcher.text.
    expectTextContrast(theme.text, theme.launcher.surface);
  });
});

describe.each([
  ['light', publicLight],
  ['dark', publicDark],
] as const)('public website %s theme', (_name, theme) => {
  it('keeps brand text and controls readable', () => {
    expectTextContrast(theme.text, theme.canvas);
    expectTextContrast(theme['text-light'], theme.canvas);
    expectTextContrast(theme['text-light'], theme['surface-muted']);
    expectTextContrast(theme['accent-text'], theme.canvas);
    expectTextContrast(theme['accent-text'], theme['surface-muted']);
    expectTextContrast(theme.heading, theme.canvas);
    expectTextContrast(theme['navy-deep'], theme.accent);
    expectTextContrast(theme['footer-text'], theme['navy-deep']);
    expectBoundaryContrast(theme.border, theme.surface);
    expectBoundaryContrast(theme.border, theme['surface-muted']);
  });
});

describe.each([
  ['light', widgetLight],
  ['dark', widgetDark],
] as const)('Noodle widget %s theme', (_name, theme) => {
  it('keeps status text, metadata, and boundaries accessible', () => {
    expectTextContrast(theme['tv-text'], theme['tv-canvas']);
    expectTextContrast(theme['tv-muted'], theme['tv-surface']);
    expectTextContrast(theme['tv-muted'], theme['tv-surface-muted']);
    expectTextContrast(theme['tv-accent'], theme['tv-surface']);
    expectTextContrast(theme['tv-success'], theme['tv-success-soft']);
    expectTextContrast(theme['tv-danger'], theme['tv-danger-soft']);
    expectTextContrast(theme['tv-warning'], theme['tv-warning-soft']);
    expectTextContrast(theme['tv-accent-text'], theme['tv-accent']);
    expectBoundaryContrast(theme['tv-border'], theme['tv-surface']);
    expectBoundaryContrast(theme['tv-border'], theme['tv-surface-muted']);
  });
});
