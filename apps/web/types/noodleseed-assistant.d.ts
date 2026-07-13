// Ambient declarations for @noodleseed/assistant subpath exports.
//
// The package ships correct types (node_modules/@noodleseed/assistant/dist/{react,server}.d.ts),
// but this app uses `moduleResolution: "node"`, which cannot resolve the package's `exports` map
// or its `.js`-suffixed internal type imports. Next/webpack resolves the real modules at runtime;
// these shims only satisfy tsc. Mirror of @noodleseed/assistant@1.0.0 — update if the API changes.

declare module '@noodleseed/assistant/react' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react';

  export type AssistantThemeMode = 'auto' | 'light' | 'dark';

  export interface NoodleAssistantProps {
    readonly sessionEndpoint: string;
    readonly theme?: AssistantThemeMode;
    readonly open?: boolean;
    readonly className?: string;
    readonly onReady?: () => void;
    readonly onError?: (error: { readonly code: string }) => void;
  }

  export const NoodleAssistant: ForwardRefExoticComponent<
    NoodleAssistantProps & RefAttributes<HTMLElement>
  >;
}

declare module '@noodleseed/assistant/server' {
  export interface CreateAssistantSessionInput {
    readonly serviceUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly origin: string;
    readonly user: {
      readonly id: string;
      readonly email?: string;
      readonly name?: string;
      readonly tenant?: string;
      readonly roles?: readonly string[];
    };
    readonly context?: Readonly<
      Record<string, string | number | boolean | null>
    >;
  }

  export interface AssistantSession {
    readonly token: string;
    readonly expiresAt: string;
    readonly gatewayUrl?: string;
    // Newer Noodle Cloud responses deliver the gateway here (the v1.0.0 type predates it).
    readonly endpoints?: {
      readonly turns?: string;
      readonly toolConfirmations?: string;
    };
  }

  export function createAssistantSession(
    input: CreateAssistantSessionInput,
    dependencies?: { readonly fetch?: typeof fetch }
  ): Promise<AssistantSession>;
}
