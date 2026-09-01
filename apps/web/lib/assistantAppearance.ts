// Full per-theme palette for the embedded assistant, so the opened panel reads as part of
// Tivmark rather than the assistant's default accent. Literal values cross the assistant's
// shadow-DOM boundary; keep these aligned with styles/globals.css and tailwind.config.js.
export const ASSISTANT_APPEARANCE = {
  light: {
    canvas: '#f7f5f0',
    text: '#2a2a2a',
    mutedText: '#646464',
    link: '#795f2b',
    focus: '#795f2b',
    success: '#2b704e',
    warning: '#795f2b',
    danger: '#a83d3d',
    panel: { surface: '#ffffff', text: '#2a2a2a', border: '#8b8373' },
    header: { surface: '#ece8df', text: '#1a2744', border: '#8b8373' },
    assistantMessage: {
      surface: '#ece8df',
      text: '#2a2a2a',
      border: '#8b8373',
    },
    userMessage: { surface: '#1a2744', text: '#f7f5f0' },
    composer: { surface: '#ffffff', text: '#2a2a2a', border: '#8b8373' },
    suggestion: { surface: '#ece8df', text: '#1a2744', border: '#8b8373' },
    confirmation: { surface: '#ffffff', text: '#2a2a2a', border: '#8b8373' },
    primaryButton: { surface: '#1a2744', text: '#f7f5f0' },
    secondaryButton: { surface: '#ece8df', text: '#1a2744', border: '#8b8373' },
    // The SDK's expanded launcher input currently consumes the global text role rather
    // than launcher.text. This surface keeps both roles accessible until that is corrected.
    launcher: { surface: '#ffffff', text: '#1a2744', border: '#1a2744' },
    code: { surface: '#ece8df', text: '#2a2a2a', border: '#8b8373' },
    app: { surface: '#ffffff', text: '#2a2a2a', border: '#8b8373' },
  },
  dark: {
    canvas: '#0b1222',
    text: '#f7f5f0',
    mutedText: '#c4c0b8',
    link: '#c9a96e',
    focus: '#c9a96e',
    success: '#67b58d',
    warning: '#c9a96e',
    danger: '#e47777',
    panel: { surface: '#111c33', text: '#f7f5f0', border: '#6f82a0' },
    header: { surface: '#1a2744', text: '#f7f5f0', border: '#6f82a0' },
    assistantMessage: {
      surface: '#1a2744',
      text: '#f7f5f0',
      border: '#6f82a0',
    },
    userMessage: { surface: '#c9a96e', text: '#111c33' },
    composer: { surface: '#111c33', text: '#f7f5f0', border: '#6f82a0' },
    suggestion: { surface: '#1a2744', text: '#f7f5f0', border: '#6f82a0' },
    confirmation: { surface: '#1a2744', text: '#f7f5f0', border: '#6f82a0' },
    primaryButton: { surface: '#c9a96e', text: '#111c33' },
    secondaryButton: { surface: '#1a2744', text: '#f7f5f0', border: '#6f82a0' },
    launcher: { surface: '#1a2744', text: '#f7f5f0', border: '#c9a96e' },
    code: { surface: '#0b1222', text: '#f7f5f0', border: '#6f82a0' },
    app: { surface: '#111c33', text: '#f7f5f0', border: '#6f82a0' },
  },
} as const;
