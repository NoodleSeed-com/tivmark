import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { methodNotAllowed, sendProblem } from '@/lib/api/http';
import { verifyResearchWorker } from '@/lib/enterprise-research';
import { processEnterpriseResearch } from 'models/enterpriseOnboarding';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);
    await verifyResearchWorker(req.headers.authorization);
    const input = z
      .object({ runId: z.string().uuid() })
      .strict()
      .parse(req.body);
    await processEnterpriseResearch(input.runId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendProblem(res, error);
  }
}
