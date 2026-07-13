import type { NextApiRequest, NextApiResponse } from 'next';
import { createAssistantSession } from '@noodleseed/assistant/server';

import env from '@/lib/env';
import { getSession } from '@/lib/session';

// Backend session exchange for the embedded Tivmark assistant.
//
// The browser widget (components/shared/shell/AssistantWidget.tsx) calls this endpoint. We verify
// the logged-in NextAuth session, then mint a short-lived assistant session bound to the request
// origin using the deployment-bound client credentials. The clientSecret never leaves the server.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { serviceUrl, clientId, clientSecret } = env.assistant;
  if (!serviceUrl || !clientId || !clientSecret) {
    return res
      .status(503)
      .json({ error: { message: 'Assistant is not configured' } });
  }

  const origin =
    req.headers.origin ||
    (req.headers.host ? `https://${req.headers.host}` : env.appUrl);

  try {
    const assistantSession = await createAssistantSession({
      serviceUrl,
      clientId,
      clientSecret,
      origin,
      user: {
        id: session.user.id,
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      },
    });

    // The @noodleseed/assistant@1.0.0 widget reads `session.gatewayUrl`, but the Noodle Cloud
    // session response now delivers the gateway under `endpoints.turns`. Bridge the two so the
    // widget POSTs turns to the absolute gateway instead of a relative (portal 404) URL.
    return res.status(200).json({
      ...assistantSession,
      gatewayUrl:
        assistantSession.gatewayUrl ?? assistantSession.endpoints?.turns,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create assistant session';
    return res.status(502).json({ error: { message } });
  }
}
