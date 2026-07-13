import {
  customerAuth,
  embeddedAssistant,
  openAICompatible,
  secret,
  server,
  tool,
  z,
} from '@noodleseed/one';

// The server name and title derive from your project name — if you repurpose or rename this app,
// update both (and noodle.json) so its identity stays consistent in MCP hosts.
export default server(
  'tivmark_assistant',
  {
    title: 'Tivmark Assistant',
    version: '1.0.0',
    // 'customers' access: the Tivmark portal backend (apps/web) bridges the logged-in user's
    // identity into a short-lived assistant session via createAssistantSession + the client secret.
    auth: customerAuth.bridge({
      provider: 'tivmark-portal',
      user: { id: 'id', email: 'email', name: 'name', roles: 'roles' },
    }),
    // Customer-branded assistant embedded in the Tivmark portal (apps/web). The browser reaches it
    // through a backend session exchange, so allowedOrigins gates which sites may open a session.
    assistant: embeddedAssistant({
      model: openAICompatible({
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-sonnet-5',
        apiKey: secret('ASSISTANT_MODEL_API_KEY'),
      }),
      // allowedOrigins must be https — add any preview/staging portal origins here as needed.
      allowedOrigins: ['https://app.tivmark.com'],
      layout: { mode: 'floating', position: 'bottom-right' },
      labels: { welcomeHeading: 'Tivmark Assistant', welcomeMessage: 'How can I help?' },
    }),
  },
  [
    tool('greet', {
      description: 'Greet a person by name.',
      input: z.object({
        name: z.string().default('world'),
      }),
      output: z.object({
        message: z.string(),
      }),
      fulfil: ({ input }) => {
        return { message: `Hello, ${input.name}!` };
      },
    }),
  ],
);
