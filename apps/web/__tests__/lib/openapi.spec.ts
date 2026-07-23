import { getOpenApiDocument } from '@/lib/api/openapi';

describe('Tivmark OpenAPI contract', () => {
  const document = getOpenApiDocument();

  it('publishes an OpenAPI 3.1 contract with bearer and OAuth security', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.components?.securitySchemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer' },
      oauth2: { type: 'oauth2' },
    });
  });

  it.each([
    '/api/v1/me',
    '/api/v1/teams',
    '/api/v1/teams/{teamId}/members',
    '/api/v1/teams/{teamId}/invitations',
    '/api/v1/teams/{teamId}/time-off/requests',
    '/api/v1/teams/{teamId}/credentials',
    '/api/v1/teams/{teamId}/oauth-clients',
    '/api/v1/teams/{teamId}/sso',
    '/api/v1/teams/{teamId}/dsync',
    '/api/v1/teams/{teamId}/webhooks',
    '/api/v1/teams/{teamId}/payments/products',
    '/api/v1/teams/{teamId}/audit-logs/viewer-token',
  ])('documents %s', (path) => {
    expect(document.paths?.[path]).toBeDefined();
  });

  it('assigns a unique operationId to every operation', () => {
    const operationIds = Object.values(document.paths || {}).flatMap(
      (pathItem) =>
        ['get', 'post', 'put', 'patch', 'delete'].flatMap((method) => {
          const operation = pathItem?.[method as keyof typeof pathItem] as
            { operationId?: string } | undefined;
          return operation?.operationId ? [operation.operationId] : [];
        })
    );
    const operationCount = Object.values(document.paths || {}).reduce(
      (count, pathItem) =>
        count +
        ['get', 'post', 'put', 'patch', 'delete'].filter(
          (method) => pathItem?.[method as keyof typeof pathItem]
        ).length,
      0
    );

    expect(operationIds).toHaveLength(operationCount);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('documents idempotency on retryable create operations', () => {
    const operation =
      document.paths?.['/api/v1/teams/{teamId}/credentials']?.post;
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: 'header',
          name: 'Idempotency-Key',
        }),
      ])
    );
  });
});
