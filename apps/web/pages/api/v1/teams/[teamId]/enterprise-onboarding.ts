import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireTeamPrincipal } from '@/lib/api/team';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { withIdempotency } from '@/lib/api/idempotency';
import { enterpriseCommandSchema } from '@/lib/enterprise-onboarding';
import { enterpriseAssistantWorkspace } from '@/lib/enterprise-assistant';
import { ApiError } from '@/lib/errors';
import {
  changeEnterpriseWorkspace,
  getEnterpriseWorkspace,
} from 'models/enterpriseOnboarding';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!['GET', 'POST'].includes(req.method ?? ''))
      return methodNotAllowed(req, res, ['GET', 'POST']);
    const access = await requireTeamPrincipal(
      req,
      res,
      z.string().min(1).parse(req.query.teamId),
      'teams'
    );
    if (!access.member || access.principal.type !== 'user')
      throw new ApiError(403, 'An authenticated team member is required');
    res.setHeader('Cache-Control', 'private, no-store');
    const data =
      req.method === 'GET'
        ? await getEnterpriseWorkspace(access.member)
        : await changeEnterpriseWorkspace(
            access.member,
            enterpriseCommandSchema.parse(req.body)
          );
    return res.status(200).json({
      data:
        req.query.view === 'assistant'
          ? enterpriseAssistantWorkspace(data)
          : data,
    });
  } catch (error) {
    return sendProblem(res, error);
  }
}

export default withIdempotency(handler);
