import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'OAuth access token or Tivmark service key',
});

const oauth2 = registry.registerComponent('securitySchemes', 'oauth2', {
  type: 'oauth2',
  flows: {
    authorizationCode: {
      authorizationUrl: '/oauth/authorize',
      tokenUrl: '/oauth/token',
      refreshUrl: '/oauth/token',
      scopes: {
        profile: 'Read and update the current profile',
        teams: 'Read and update teams',
        members: 'Read and manage team members',
        invitations: 'Read and manage invitations',
        time_off: 'Read and manage time-off requests',
        'time_off.approve': 'Approve or decline time-off requests',
        'time_off.policy': 'Manage time-off allowances',
        credentials: 'Manage service credentials and OAuth clients',
        sso: 'Manage single sign-on',
        directory_sync: 'Manage directory synchronization',
        webhooks: 'Manage outbound webhooks',
        audit_logs: 'Read audit logs',
        billing: 'Read and manage billing',
      },
    },
  },
});

const security = [{ [oauth2.name]: [] }, { [bearerAuth.name]: [] }];
const uuid = z.string().uuid();
const role = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const leaveType = z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']);
const leaveStatus = z.enum(['PENDING', 'APPROVED', 'DECLINED', 'CANCELED']);

const Problem = z
  .object({
    type: z.string(),
    code: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    errors: z.record(z.array(z.string())).optional(),
  })
  .openapi('Problem');

const User = z
  .object({
    id: uuid,
    name: z.string(),
    email: z.string().email(),
    image: z.string().nullable(),
  })
  .openapi('User');

const Team = z
  .object({
    id: uuid,
    name: z.string(),
    slug: z.string(),
    domain: z.string().nullable(),
    defaultRole: role,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Team');

const Member = z
  .object({
    id: uuid,
    role,
    createdAt: z.string().datetime(),
    user: User,
  })
  .openapi('Member');

const Invitation = z
  .object({
    id: uuid,
    email: z.string().email().nullable(),
    role,
    token: z.string(),
    expires: z.string().datetime(),
    sentViaEmail: z.boolean(),
  })
  .openapi('Invitation');

const TimeOffRequest = z
  .object({
    id: uuid,
    type: leaveType,
    status: leaveStatus,
    startDate: z.string().date(),
    endDate: z.string().date(),
    duration: z.enum(['FULL_DAY', 'HALF_DAY']),
    halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).nullable(),
    requestedHalfDays: z.number().int(),
    reason: z.string().nullable(),
    reviewNote: z.string().nullable(),
    requester: User,
    reviewer: User.nullable(),
  })
  .openapi('TimeOffRequest');

const TimeOffPolicy = z
  .object({
    id: uuid,
    type: leaveType,
    annualAllowanceHalfDays: z.number().int().nullable(),
  })
  .openapi('TimeOffPolicy');

const TimeOffBalance = z.object({
  allowanceHalfDays: z.number().int().nullable(),
  approvedHalfDays: z.number().int(),
  pendingHalfDays: z.number().int(),
  remainingHalfDays: z.number().int().nullable(),
});

const TimeOffWorkspace = z
  .object({
    year: z.number().int(),
    canApprove: z.boolean(),
    currentUserId: uuid,
    policies: z.array(TimeOffPolicy),
    requests: z.array(TimeOffRequest),
    members: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        email: z.string().email(),
        role,
      })
    ),
    balances: z.record(z.record(TimeOffBalance)),
  })
  .openapi('TimeOffWorkspace');

const Credential = z
  .object({
    id: uuid,
    name: z.string(),
    scopes: z.array(z.string()),
    expiresAt: z.string().datetime().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Credential');

const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema });
const list = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: z.array(schema),
    meta: z.object({ nextCursor: z.string().nullable() }).optional(),
  });
const json = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});
const problemResponses = {
  400: { description: 'Invalid request', content: json(Problem) },
  401: { description: 'Authentication required', content: json(Problem) },
  403: { description: 'Insufficient permissions', content: json(Problem) },
  404: { description: 'Resource not found', content: json(Problem) },
  409: { description: 'Resource conflict', content: json(Problem) },
  422: { description: 'Validation failed', content: json(Problem) },
  429: { description: 'Rate limit exceeded', content: json(Problem) },
};
const teamParams = z.object({
  teamId: uuid.openapi({ param: { in: 'path', name: 'teamId' } }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me',
  tags: ['Profile'],
  summary: 'Get the current user',
  security,
  responses: {
    200: { description: 'Current user', content: json(data(User)) },
    ...problemResponses,
  },
});

const genericObject = z.record(z.unknown());
const simpleOperation = (
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  tag: string,
  summary: string,
  options: { body?: z.ZodTypeAny; params?: z.AnyZodObject } = {}
) =>
  registry.registerPath({
    method,
    path,
    tags: [tag],
    summary,
    security,
    request: {
      ...(options.params ? { params: options.params } : {}),
      ...(options.body ? { body: { content: json(options.body) } } : {}),
    },
    responses: {
      200: {
        description: 'Successful response',
        content: json(data(genericObject)),
      },
      204: { description: 'Operation completed' },
      ...problemResponses,
    },
  });

simpleOperation('put', '/api/v1/me/password', 'Profile', 'Change password', {
  body: z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
  }),
});
simpleOperation(
  'get',
  '/api/v1/me/sessions',
  'Profile',
  'List active sessions'
);
simpleOperation(
  'delete',
  '/api/v1/me/sessions/{sessionId}',
  'Profile',
  'Revoke a session',
  {
    params: z.object({ sessionId: z.string() }),
  }
);
simpleOperation(
  'get',
  '/api/v1/teams/{teamId}/permissions',
  'Teams',
  'Get effective permissions',
  { params: teamParams }
);
simpleOperation(
  'get',
  '/api/v1/teams/{teamId}/time-off/balances',
  'Time Off',
  'Get employee balances',
  { params: teamParams }
);
simpleOperation(
  'delete',
  '/api/v1/teams/{teamId}/credentials/{credentialId}',
  'Credentials',
  'Revoke a service credential',
  {
    params: z.object({ teamId: uuid, credentialId: uuid }),
  }
);
simpleOperation(
  'get',
  '/api/v1/teams/{teamId}/oauth-clients',
  'Credentials',
  'List OAuth clients',
  { params: teamParams }
);
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/oauth-clients',
  'Credentials',
  'Register an OAuth client',
  {
    params: teamParams,
    body: z.object({
      name: z.string(),
      redirectUris: z.array(z.string().url()),
      allowedOrigins: z.array(z.string().url()),
      scopes: z.array(z.string()),
    }),
  }
);
simpleOperation(
  'delete',
  '/api/v1/teams/{teamId}/oauth-clients/{clientId}',
  'Credentials',
  'Delete an OAuth client',
  {
    params: z.object({ teamId: uuid, clientId: z.string() }),
  }
);

for (const [path, tag, summary] of [
  ['/api/v1/teams/{teamId}/sso', 'SSO', 'Manage single sign-on'],
  [
    '/api/v1/teams/{teamId}/dsync',
    'Directory Sync',
    'Manage directory synchronization',
  ],
  ['/api/v1/teams/{teamId}/webhooks', 'Webhooks', 'Manage outbound webhooks'],
  [
    '/api/v1/teams/{teamId}/payments/products',
    'Billing',
    'List billing products',
  ],
] as const) {
  simpleOperation('get', path, tag, summary, { params: teamParams });
}
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/sso',
  'SSO',
  'Create SSO configuration',
  { params: teamParams, body: genericObject }
);
simpleOperation(
  'patch',
  '/api/v1/teams/{teamId}/sso',
  'SSO',
  'Update SSO configuration',
  { params: teamParams, body: genericObject }
);
simpleOperation(
  'delete',
  '/api/v1/teams/{teamId}/sso',
  'SSO',
  'Delete SSO configuration',
  { params: teamParams }
);
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/dsync',
  'Directory Sync',
  'Create directory synchronization',
  { params: teamParams, body: genericObject }
);
for (const method of ['get', 'patch', 'delete'] as const) {
  simpleOperation(
    method,
    '/api/v1/teams/{teamId}/dsync/{directoryId}',
    'Directory Sync',
    `${method === 'get' ? 'Get' : method === 'patch' ? 'Update' : 'Delete'} directory synchronization`,
    {
      params: z.object({ teamId: uuid, directoryId: z.string() }),
      ...(method === 'patch' ? { body: genericObject } : {}),
    }
  );
}
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/webhooks',
  'Webhooks',
  'Create an outbound webhook',
  { params: teamParams, body: genericObject }
);
simpleOperation(
  'delete',
  '/api/v1/teams/{teamId}/webhooks',
  'Webhooks',
  'Delete an outbound webhook',
  { params: teamParams }
);
simpleOperation(
  'get',
  '/api/v1/teams/{teamId}/webhooks/{endpointId}',
  'Webhooks',
  'Get an outbound webhook',
  { params: z.object({ teamId: uuid, endpointId: z.string() }) }
);
simpleOperation(
  'put',
  '/api/v1/teams/{teamId}/webhooks/{endpointId}',
  'Webhooks',
  'Update an outbound webhook',
  {
    params: z.object({ teamId: uuid, endpointId: z.string() }),
    body: genericObject,
  }
);
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/payments/create-checkout-session',
  'Billing',
  'Create a checkout session',
  { params: teamParams, body: genericObject }
);
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/payments/create-portal-link',
  'Billing',
  'Create a billing portal link',
  { params: teamParams }
);
simpleOperation(
  'post',
  '/api/v1/teams/{teamId}/audit-logs/viewer-token',
  'Audit Logs',
  'Create a short-lived audit-log viewer token',
  { params: teamParams }
);
registry.registerPath({
  method: 'patch',
  path: '/api/v1/me',
  tags: ['Profile'],
  summary: 'Update the current user',
  security,
  request: {
    body: {
      content: json(
        z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          image: z.string().optional(),
        })
      ),
    },
  },
  responses: {
    200: { description: 'Updated user', content: json(data(User)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams',
  tags: ['Teams'],
  summary: 'List accessible teams',
  security,
  responses: {
    200: { description: 'Teams', content: json(list(Team)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/teams',
  tags: ['Teams'],
  summary: 'Create a team',
  security,
  request: { body: { content: json(z.object({ name: z.string().min(1) })) } },
  responses: {
    201: { description: 'Created team', content: json(data(Team)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}',
  tags: ['Teams'],
  summary: 'Get a team',
  security,
  request: { params: teamParams },
  responses: {
    200: { description: 'Team', content: json(data(Team)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'patch',
  path: '/api/v1/teams/{teamId}',
  tags: ['Teams'],
  summary: 'Update a team',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          name: z.string().optional(),
          slug: z.string().optional(),
          domain: z.string().nullable().optional(),
        })
      ),
    },
  },
  responses: {
    200: { description: 'Updated team', content: json(data(Team)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/teams/{teamId}',
  tags: ['Teams'],
  summary: 'Delete a team',
  security,
  request: { params: teamParams },
  responses: { 204: { description: 'Team deleted' }, ...problemResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/members',
  tags: ['Members'],
  summary: 'List team members',
  security,
  request: { params: teamParams },
  responses: {
    200: { description: 'Members', content: json(list(Member)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'patch',
  path: '/api/v1/teams/{teamId}/members/{userId}',
  tags: ['Members'],
  summary: 'Change a member role',
  security,
  request: {
    params: z.object({ teamId: uuid, userId: uuid }),
    body: { content: json(z.object({ role })) },
  },
  responses: {
    200: { description: 'Updated member', content: json(data(Member)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/teams/{teamId}/members/{userId}',
  tags: ['Members'],
  summary: 'Remove a team member',
  security,
  request: { params: z.object({ teamId: uuid, userId: uuid }) },
  responses: { 204: { description: 'Member removed' }, ...problemResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/invitations',
  tags: ['Invitations'],
  summary: 'List invitations',
  security,
  request: { params: teamParams },
  responses: {
    200: { description: 'Invitations', content: json(list(Invitation)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/teams/{teamId}/invitations',
  tags: ['Invitations'],
  summary: 'Create an invitation',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          email: z.string().email().optional(),
          role,
          sentViaEmail: z.boolean().default(true),
        })
      ),
    },
  },
  responses: {
    201: { description: 'Created invitation', content: json(data(Invitation)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/time-off',
  tags: ['Time Off'],
  summary: 'Get the time-off workspace',
  security,
  request: {
    params: teamParams,
    query: z.object({ year: z.coerce.number().int().optional() }),
  },
  responses: {
    200: {
      description: 'Time-off workspace',
      content: json(data(TimeOffWorkspace)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/time-off/requests',
  tags: ['Time Off'],
  summary: 'List time-off requests',
  security,
  request: {
    params: teamParams,
    query: z.object({
      year: z.coerce.number().int().optional(),
      status: leaveStatus.optional(),
      type: leaveType.optional(),
      requesterId: uuid.optional(),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().max(100).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Time-off requests',
      content: json(list(TimeOffRequest)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/teams/{teamId}/time-off/requests',
  tags: ['Time Off'],
  summary: 'Request time off',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          requesterId: uuid.optional(),
          type: leaveType,
          startDate: z.string().date(),
          endDate: z.string().date(),
          duration: z.enum(['FULL_DAY', 'HALF_DAY']),
          halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).nullable().optional(),
          reason: z.string().max(500).nullable().optional(),
        })
      ),
    },
  },
  responses: {
    201: {
      description: 'Created request',
      content: json(data(TimeOffRequest)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'patch',
  path: '/api/v1/teams/{teamId}/time-off/requests/{requestId}',
  tags: ['Time Off'],
  summary: 'Update, cancel, approve, or decline a request',
  security,
  request: {
    params: z.object({ teamId: uuid, requestId: uuid }),
    body: {
      content: json(
        z
          .object({
            action: z.enum(['update', 'cancel', 'approve', 'decline']),
            reviewNote: z.string().max(500).optional(),
          })
          .passthrough()
      ),
    },
  },
  responses: {
    200: {
      description: 'Updated request',
      content: json(data(TimeOffRequest)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/time-off/policies',
  tags: ['Time Off'],
  summary: 'List allowance policies',
  security,
  request: { params: teamParams },
  responses: {
    200: { description: 'Policies', content: json(list(TimeOffPolicy)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'patch',
  path: '/api/v1/teams/{teamId}/time-off/policies',
  tags: ['Time Off'],
  summary: 'Update allowance policies',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          allowances: z.record(leaveType, z.number().int().nullable()),
        })
      ),
    },
  },
  responses: {
    200: { description: 'Policies', content: json(list(TimeOffPolicy)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/credentials',
  tags: ['Credentials'],
  summary: 'List service credentials',
  security,
  request: { params: teamParams },
  responses: {
    200: { description: 'Credentials', content: json(list(Credential)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/teams/{teamId}/credentials',
  tags: ['Credentials'],
  summary: 'Create a service credential',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          name: z.string().min(1),
          scopes: z.array(z.string()),
          expiresInDays: z.number().int().min(1).max(365).default(90),
        })
      ),
    },
  },
  responses: {
    201: {
      description: 'Credential and one-time secret',
      content: json(data(Credential.extend({ apiKey: z.string() }))),
    },
    ...problemResponses,
  },
});

const operationIdFor = (method: string, path: string) =>
  `${method}_${path
    .replace(/^\/api\/v1\//, '')
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')}`;

const idempotentPaths = new Set([
  '/api/v1/teams',
  '/api/v1/teams/{teamId}/invitations',
  '/api/v1/teams/{teamId}/time-off/requests',
  '/api/v1/teams/{teamId}/credentials',
  '/api/v1/teams/{teamId}/oauth-clients',
  '/api/v1/teams/{teamId}/webhooks',
  '/api/v1/teams/{teamId}/dsync',
  '/api/v1/teams/{teamId}/sso',
  '/api/v1/teams/{teamId}/payments/create-checkout-session',
]);

export const getOpenApiDocument = () => {
  const document = new OpenApiGeneratorV31(
    registry.definitions
  ).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Tivmark API',
      version: '1.0.0',
      description:
        'The API-first contract used by Tivmark and approved headless clients.',
      license: { name: 'Proprietary', url: 'https://tivmark.com/terms' },
    },
    servers: [{ url: 'https://app.tivmark.com', description: 'Production' }],
    tags: [
      { name: 'Profile', description: 'Current-user profile and sessions.' },
      { name: 'Teams', description: 'Team lifecycle and settings.' },
      { name: 'Members', description: 'Team membership and roles.' },
      {
        name: 'Invitations',
        description: 'Team invitations and acceptance.',
      },
      {
        name: 'Time Off',
        description: 'Time-off requests, balances, and policies.',
      },
      {
        name: 'Credentials',
        description: 'Scoped service credentials and OAuth clients.',
      },
      { name: 'SSO', description: 'Single sign-on configuration.' },
      {
        name: 'Directory Sync',
        description: 'Directory synchronization configuration.',
      },
      { name: 'Webhooks', description: 'Outbound webhook configuration.' },
      { name: 'Billing', description: 'Plans and billing workflows.' },
      {
        name: 'Audit Logs',
        description: 'Auditable activity and viewer access.',
      },
    ],
  });

  for (const [path, pathItem] of Object.entries(document.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem?.[method];
      if (operation && !operation.operationId) {
        operation.operationId = operationIdFor(method, path);
      }
      if (operation && method !== 'get' && idempotentPaths.has(path)) {
        operation.parameters ||= [];
        operation.parameters.push({
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          description:
            'Unique retry key. Reusing it with the same body returns the original response for 24 hours.',
          schema: { type: 'string', minLength: 8, maxLength: 200 },
        });
      }
    }
  }

  return document;
};
