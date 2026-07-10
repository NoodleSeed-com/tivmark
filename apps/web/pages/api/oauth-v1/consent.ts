import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import {
  consumeOAuthPayload,
  redirectWithAuthorizationCode,
} from '@/lib/api/oauth';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { ApiError } from '@/lib/errors';
import { getSession } from '@/lib/session';

const schema = z.object({
  request: z.string().min(32),
  decision: z.enum(['approve', 'deny']),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
    const session = await getSession(req, res);
    if (!session?.user?.id) throw new ApiError(401, 'Unauthorized');
    const input = schema.parse(req.body);
    const authorization = await consumeOAuthPayload(
      'AUTHORIZATION_REQUEST',
      input.request
    );
    if (authorization.userId !== session.user.id) {
      throw new ApiError(
        403,
        'This authorization request belongs to another user'
      );
    }

    const redirect = new URL(String(authorization.redirectUri));
    if (input.decision === 'deny') {
      redirect.searchParams.set('error', 'access_denied');
      redirect.searchParams.set('state', String(authorization.state));
      return res.redirect(303, redirect.toString());
    }

    return res.redirect(
      303,
      await redirectWithAuthorizationCode({
        clientId: String(authorization.clientId),
        userId: String(authorization.userId),
        redirectUri: String(authorization.redirectUri),
        codeChallenge: String(authorization.codeChallenge),
        scopes: z.array(z.string()).parse(authorization.scopes),
        state: String(authorization.state),
      })
    );
  } catch (error) {
    return sendProblem(res, error);
  }
}
