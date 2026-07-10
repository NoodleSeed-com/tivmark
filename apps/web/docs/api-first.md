# API-first development

Every user-facing Tivmark capability is implemented as a versioned API
contract before UI work begins. The web application consumes the same
`/api/v1` operations that are available to approved headless clients.

## Required workflow

1. Define Zod request and response schemas and register the OpenAPI operation.
2. Implement the route with unified principal, scope, and team-role checks.
3. Generate and lint `openapi.generated.json` and the TypeScript client.
4. Build the UI against the generated client, not an unversioned endpoint.
5. Add positive, authorization, validation, and contract tests.

Infrastructure callbacks such as NextAuth, inbound webhooks, SCIM receivers,
health checks, and OAuth protocol endpoints are intentionally outside the
public product API.

Authenticated requests are rate limited per user or service credential.
Retryable create operations accept an `Idempotency-Key` header; keys are
durable for 24 hours and cannot be reused with a different request body.
