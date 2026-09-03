/** @jest-environment node */
jest.mock('google-auth-library', () => {
  const request = jest.fn();
  const verifyIdToken = jest.fn();
  return {
    GoogleAuth: jest.fn(() => ({ getClient: async () => ({ request }) })),
    OAuth2Client: jest.fn(() => ({ verifyIdToken })),
    __request: request,
    __verify: verifyIdToken,
  };
});
import {
  enqueueResearch,
  normalizeWebsiteContext,
  researchCompany,
  verifyResearchWorker,
} from '@/lib/enterprise-research';

const { __request: request, __verify: verify } = jest.requireMock(
  'google-auth-library'
) as { __request: jest.Mock; __verify: jest.Mock };
const grounded = {
  candidates: [
    {
      content: {
        parts: [
          { text: 'Private reasoning', thought: true },
          { text: 'Example makes widgets.' },
        ],
      },
      urlContextMetadata: {
        urlMetadata: [
          {
            retrievedUrl: 'https://example.com/about',
            urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
          },
          {
            retrievedUrl: 'javascript:alert(1)',
            urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
          },
          {
            retrievedUrl: 'https://example.com/missing',
            urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_ERROR',
          },
          {
            retrievedUrl: 'https://unapproved.example.net',
            urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
          },
        ],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 20,
    candidatesTokenCount: 30,
    thoughtsTokenCount: 10,
  },
};
const identity = { companyName: 'Example', companyDomain: 'example.com' };
const structured = (suggestions: unknown[]) => ({
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              suggestions,
              unknowns: ['Internal access configuration is unknown.'],
            }),
          },
        ],
      },
    },
  ],
  modelVersion: 'gemini-3.8-flash',
  usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 30 },
});

describe('keyless Google organization research', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ONBOARDING_RESEARCH_PROJECT = 'tivmark-test';
    process.env.ONBOARDING_RESEARCH_QUEUE = 'onboarding-test';
    process.env.ONBOARDING_RESEARCH_SERVICE_ACCOUNT =
      'worker@tivmark-test.iam.gserviceaccount.com';
    process.env.APP_URL = 'https://app.tivmark.com';
  });
  it('retains successful in-scope URLs and excludes reasoning, failures and other domains', () => {
    expect(normalizeWebsiteContext(grounded, 'example.com')).toEqual({
      report: 'Example makes widgets.',
      sources: [
        {
          id: 'source-0',
          title: 'example.com',
          url: 'https://example.com/about',
        },
      ],
    });
  });
  it('uses fixed Google endpoints and two bounded calls; filters forbidden or unsupported proposals', async () => {
    request.mockResolvedValueOnce({ data: grounded }).mockResolvedValueOnce({
      data: structured([
        {
          stepId: 'organization',
          fieldId: 'industry',
          value: 'Widgets',
          kind: 'sourced',
          sourceIds: ['source-0'],
        },
        {
          stepId: 'security',
          fieldId: 'securityDecision',
          value: 'Approved for pilot',
          kind: 'sourced',
          sourceIds: ['source-0'],
        },
        {
          stepId: 'organization',
          fieldId: 'employees',
          value: '10000',
          kind: 'sourced',
          sourceIds: ['source-0'],
        },
        {
          stepId: 'organization',
          fieldId: 'headquarters',
          value: 'Atlantis',
          kind: 'sourced',
          sourceIds: ['invented'],
        },
        {
          stepId: 'outcomes',
          fieldId: 'successMetric',
          value: 'Measure pilot completion',
          kind: 'recommendation',
          sourceIds: ['invented'],
        },
      ]),
    });
    const result = await researchCompany(identity, 'gemini-3.8-flash');
    expect(result.suggestions.map((s) => s.fieldId)).toEqual([
      'industry',
      'successMetric',
    ]);
    expect(result.suggestions[1].sourceIds).toEqual([]);
    expect(result.inputTokens).toBe(70);
    expect(result.outputTokens).toBe(70);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toMatchObject({
      url: 'https://aiplatform.googleapis.com/v1/projects/tivmark-test/locations/global/publishers/google/models/gemini-3.8-flash:generateContent',
      timeout: 70000,
      retry: false,
      data: {
        tools: [{ urlContext: {} }],
        generationConfig: { maxOutputTokens: 5000 },
      },
    });
    expect(request.mock.calls[1][0].data.tools).toBeUndefined();
  });
  it('does not extract a draft without cited grounding', async () => {
    request.mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: 'Unverified answer' }] } }],
      },
    });
    await expect(
      researchCompany(identity, 'gemini-3.8-flash')
    ).rejects.toMatchObject({ status: 422 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('fails safely for malformed structured output without applying data', async () => {
    request.mockResolvedValueOnce({ data: grounded }).mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] },
    });
    await expect(
      researchCompany(identity, 'gemini-3.8-flash')
    ).rejects.toMatchObject({ status: 422 });
  });
  it('does not disclose provider tokens or response details on errors', async () => {
    request.mockRejectedValue(new Error('secret-provider-response'));
    await expect(researchCompany(identity, 'gemini-3.8-flash')).rejects.toThrow(
      'Check model access'
    );
  });
  it('enqueues a named OIDC-authenticated bounded task', async () => {
    request.mockResolvedValue({ data: {} });
    await enqueueResearch('run-1');
    expect(request.mock.calls[0][0]).toMatchObject({
      data: {
        task: {
          name: 'projects/tivmark-test/locations/us-central1/queues/onboarding-test/tasks/research-run-1',
          dispatchDeadline: '180s',
          httpRequest: {
            url: 'https://app.tivmark.com/api/assistant/onboarding-research',
            oidcToken: {
              audience:
                'https://app.tivmark.com/api/assistant/onboarding-research',
              serviceAccountEmail:
                process.env.ONBOARDING_RESEARCH_SERVICE_ACCOUNT,
            },
          },
        },
      },
    });
  });
  it('rejects missing, wrong, and unverified worker identities', async () => {
    await expect(verifyResearchWorker()).rejects.toMatchObject({ status: 401 });
    verify.mockResolvedValue({
      getPayload: () => ({ email: 'wrong@example.com', email_verified: true }),
    });
    await expect(verifyResearchWorker('Bearer test')).rejects.toMatchObject({
      status: 401,
    });
    verify.mockResolvedValue({
      getPayload: () => ({
        email: process.env.ONBOARDING_RESEARCH_SERVICE_ACCOUNT,
        email_verified: true,
      }),
    });
    await expect(verifyResearchWorker('Bearer test')).resolves.toBeUndefined();
  });
});
