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
        equipment: 'Read and manage equipment requests',
        'equipment.approve': 'Approve or decline equipment requests',
        service_requests: 'Read and create Action Desk requests',
        'service_requests.manage': 'Manage the Action Desk queue and catalog',
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
const businessSizeBand = z.enum(['1-10', '11-50', '51-200', '201+']);
const onboardingGoal = z.enum(['TIME_OFF', 'EQUIPMENT', 'BOTH']);
const serviceAudience = z.enum(['PUBLIC', 'CUSTOMER', 'EMPLOYEE']);
const serviceRequestStatus = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_REQUESTER',
  'RESOLVED',
  'CANCELED',
]);
const serviceRequestPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

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
    businessSizeBand: businessSizeBand.nullable(),
    timeZone: z.string().nullable(),
    onboardingGoal: onboardingGoal.nullable(),
    onboardingCompletedAt: z.string().datetime().nullable(),
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

const TimeOffAssessment = z.object({
  status: z.string(),
  team: z.string(),
  userId: uuid,
  type: leaveType,
  startDate: z.string().date(),
  endDate: z.string().date(),
  eligible: z.boolean(),
  decision: z.enum([
    'ELIGIBLE',
    'INVALID_DATES',
    'OVERLAP',
    'INSUFFICIENT_BALANCE',
    'POLICY_UNAVAILABLE',
  ]),
  reason: z.string(),
  requestedHalfDays: z.number().int().nonnegative(),
  pendingHalfDays: z.number().nonnegative(),
  availableBeforeHalfDays: z.number().nullable(),
  remainingAfterHalfDays: z.number().nullable(),
  conflict: z
    .object({
      id: uuid,
      startDate: z.string().date(),
      endDate: z.string().date(),
    })
    .nullable(),
  checks: z.object({
    weekday: z.boolean(),
    noOverlap: z.boolean(),
    withinBalance: z.boolean(),
  }),
  policySource: z.string(),
});

const TimeOffReceipt = z.object({
  requestId: uuid,
  status: leaveStatus,
  team: z.string(),
  type: leaveType,
  startDate: z.string().date(),
  endDate: z.string().date(),
  requestedHalfDays: z.number().int().nonnegative(),
  pendingHalfDays: z.number().nonnegative(),
  remainingAfterPendingHalfDays: z.number().nullable(),
  authenticated: z.literal(true),
});

const OnboardingBlueprint = z
  .object({
    businessName: z.string().trim().min(3).max(100),
    teamSize: businessSizeBand,
    timeZone: z.string().min(1).max(100),
    primaryGoal: onboardingGoal,
    vacationAllowanceDays: z.number().int().min(0).max(365),
    sickAllowanceDays: z.number().int().min(0).max(365),
    personalAllowanceDays: z.number().int().min(0).max(365),
  })
  .openapi('OnboardingBlueprint');

const OnboardingReceipt = z
  .object({
    status: z.literal('READY'),
    team: z.object({
      id: uuid,
      name: z.string(),
      slug: z.string(),
      teamSize: businessSizeBand.nullable(),
      timeZone: z.string().nullable(),
      primaryGoal: onboardingGoal.nullable(),
      primaryGoalLabel: z.string(),
      onboardingCompletedAt: z.string().datetime(),
    }),
    policies: z.array(
      z.object({
        type: leaveType,
        allowanceHalfDays: z.number().int().nullable(),
        allowanceDays: z.number().nullable(),
      })
    ),
    nextSteps: z.array(
      z.object({ id: z.string(), label: z.string(), url: z.string().url() })
    ),
    authenticated: z.literal(true),
  })
  .openapi('OnboardingReceipt');

const ActionService = z
  .object({
    id: uuid,
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    audience: serviceAudience,
    active: z.boolean(),
    slaHours: z.number().int().nullable(),
    requiresApproval: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ActionService');

const ServiceRequestPerson = z.object({
  id: uuid,
  name: z.string(),
  email: z.string().email(),
});

const ServiceRequestEvent = z.object({
  id: uuid,
  type: z.enum(['CREATED', 'STATUS_CHANGED', 'COMMENT', 'ASSIGNED']),
  message: z.string(),
  createdAt: z.string().datetime(),
  actor: ServiceRequestPerson.nullable(),
});

const ServiceRequest = z
  .object({
    id: uuid,
    subject: z.string(),
    description: z.string(),
    priority: serviceRequestPriority,
    status: serviceRequestStatus,
    source: z.enum(['WEB', 'ASSISTANT', 'MCP']),
    resolution: z.string().nullable(),
    resolvedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    service: ActionService,
    requester: ServiceRequestPerson,
    assignee: ServiceRequestPerson.nullable(),
    events: z.array(ServiceRequestEvent),
  })
  .openapi('ServiceRequest');

const ActionDeskWorkspace = z
  .object({
    canManage: z.boolean(),
    currentUserId: uuid,
    services: z.array(ActionService),
    requests: z.array(ServiceRequest),
  })
  .openapi('ActionDeskWorkspace');

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

registry.registerPath({
  method: 'post',
  path: '/api/v1/onboarding/complete',
  tags: ['Onboarding'],
  summary: 'Create or configure the signed-in owner’s business workspace',
  security,
  request: { body: { content: json(OnboardingBlueprint) } },
  responses: {
    200: {
      description: 'Configured workspace receipt',
      content: json(data(OnboardingReceipt)),
    },
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
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/time-off/balances',
  tags: ['Time Off'],
  summary: 'Get employee balances and optionally assess eligibility',
  security,
  request: {
    params: teamParams,
    query: z.object({
      year: z.coerce.number().int().optional(),
      type: leaveType.optional(),
      startDate: z.string().date().optional(),
      endDate: z.string().date().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Balances and optional policy-grounded eligibility result',
      content: json(
        z.object({
          data: z.record(z.record(TimeOffBalance)),
          meta: z.object({
            team: z.string(),
            userId: uuid,
            assessment: TimeOffAssessment.nullable(),
          }),
        })
      ),
    },
    ...problemResponses,
  },
});
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
  path: '/api/v1/teams/{teamId}/action-desk',
  tags: ['Action Desk'],
  summary: 'Get the service catalog and authorized request queue',
  security,
  request: { params: teamParams },
  responses: {
    200: {
      description: 'Action Desk workspace',
      content: json(data(ActionDeskWorkspace)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/action-desk/services',
  tags: ['Action Desk'],
  summary: 'List services in the team catalog',
  security,
  request: { params: teamParams },
  responses: {
    200: { description: 'Service catalog', content: json(list(ActionService)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/teams/{teamId}/action-desk/services',
  tags: ['Action Desk'],
  summary: 'Add a service to the team catalog',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().min(1).max(500),
          audience: serviceAudience,
          active: z.boolean().optional(),
          slaHours: z.number().int().min(1).max(8760).nullable().optional(),
          requiresApproval: z.boolean().optional(),
        })
      ),
    },
  },
  responses: {
    201: { description: 'Created service', content: json(data(ActionService)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'patch',
  path: '/api/v1/teams/{teamId}/action-desk/services/{serviceId}',
  tags: ['Action Desk'],
  summary: 'Update a catalog service',
  security,
  request: {
    params: z.object({ teamId: uuid, serviceId: uuid }),
    body: {
      content: json(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().min(1).max(500),
          audience: serviceAudience,
          active: z.boolean(),
          slaHours: z.number().int().min(1).max(8760).nullable(),
          requiresApproval: z.boolean(),
        })
      ),
    },
  },
  responses: {
    200: { description: 'Updated service', content: json(data(ActionService)) },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/teams/{teamId}/action-desk/requests',
  tags: ['Action Desk'],
  summary: 'List authorized service requests',
  security,
  request: {
    params: teamParams,
    query: z.object({
      status: serviceRequestStatus.optional(),
      requesterId: uuid.optional(),
    }),
  },
  responses: {
    200: {
      description: 'Service requests',
      content: json(list(ServiceRequest)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/teams/{teamId}/action-desk/requests',
  tags: ['Action Desk'],
  summary: 'Create a service request',
  security,
  request: {
    params: teamParams,
    body: {
      content: json(
        z.object({
          requesterId: uuid.optional(),
          serviceId: uuid,
          subject: z.string().min(1).max(160),
          description: z.string().min(1).max(2000),
          priority: serviceRequestPriority.default('NORMAL'),
          source: z.enum(['WEB', 'ASSISTANT', 'MCP']).default('WEB'),
        })
      ),
    },
  },
  responses: {
    201: {
      description: 'Created request',
      content: json(data(ServiceRequest)),
    },
    ...problemResponses,
  },
});
registry.registerPath({
  method: 'patch',
  path: '/api/v1/teams/{teamId}/action-desk/requests/{requestId}',
  tags: ['Action Desk'],
  summary: 'Move a service request through the queue',
  security,
  request: {
    params: z.object({ teamId: uuid, requestId: uuid }),
    body: {
      content: json(
        z.object({
          status: serviceRequestStatus,
          note: z.string().max(1000).nullable().optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: 'Updated request',
      content: json(data(ServiceRequest)),
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
      content: json(
        z.object({
          data: TimeOffRequest,
          meta: z.object({ receipt: TimeOffReceipt }),
        })
      ),
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
  '/api/v1/onboarding/complete',
  '/api/v1/teams',
  '/api/v1/teams/{teamId}/invitations',
  '/api/v1/teams/{teamId}/time-off/requests',
  '/api/v1/teams/{teamId}/action-desk/services',
  '/api/v1/teams/{teamId}/action-desk/requests',
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
      {
        name: 'Onboarding',
        description: 'Conversational business setup and activation.',
      },
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
        name: 'Action Desk',
        description: 'Configurable services and end-user request operations.',
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
