import { describe, expect, it } from 'vitest';

import app from '../src/server.js';
import {
  normalizeActionServices,
  normalizeServiceRequests,
} from '../src/views/widget-data.js';

const service = {
  id: 'service-1',
  slug: 'customer-support',
  name: 'Customer support',
  description: 'Help with a product issue.',
  audience: 'CUSTOMER' as const,
  active: true,
  slaHours: 8,
  requiresApproval: false,
};

describe('Action Desk experience', () => {
  it('normalizes a live service catalog without exposing inactive services', () => {
    expect(
      normalizeActionServices({
        team: 'acme',
        services: [service, { ...service, id: 'service-2', active: false }],
      })
    ).toEqual({
      kind: 'ready',
      data: {
        team: 'acme',
        services: [
          {
            id: 'service-1',
            name: 'Customer support',
            description: 'Help with a product issue.',
            audience: 'CUSTOMER',
            slaHours: 8,
            requiresApproval: false,
          },
        ],
      },
    });
  });

  it('normalizes durable request status and activity', () => {
    expect(
      normalizeServiceRequests({
        team: 'acme',
        requests: [
          {
            id: 'request-1',
            subject: 'Cannot sign in',
            description: 'The login page rejects my account.',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            source: 'ASSISTANT',
            resolution: null,
            createdAt: '2026-09-01T12:00:00.000Z',
            service,
            requester: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
            events: [
              {
                id: 'event-1',
                type: 'CREATED',
                message: 'Request created.',
                createdAt: '2026-09-01T12:00:00.000Z',
              },
            ],
          },
        ],
      })
    ).toMatchObject({
      kind: 'ready',
      data: {
        team: 'acme',
        activeCount: 1,
        requests: [
          {
            id: 'request-1',
            serviceName: 'Customer support',
            requesterName: 'Ada',
            activityCount: 1,
          },
        ],
      },
    });
  });

  it('keeps creation and queue transitions behind confirmation or app visibility', async () => {
    const manifest = await app.toManifest();
    const tools = Object.fromEntries(
      manifest.tools.map((tool) => [tool.name, tool])
    );
    expect(tools.start_service_request?.annotations?.confirm).toBe(true);
    expect(tools.review_service_request?.annotations?.confirm).toBe(true);
    expect(tools.review_service_request_app?.visibility).toEqual(['app']);
    expect(JSON.stringify(tools.start_service_request?.fulfilment)).toContain(
      'tiv.create_service_request'
    );
  });
});
