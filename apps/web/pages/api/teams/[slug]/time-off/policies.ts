import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { validateWithSchema } from '@/lib/zod';
import { throwIfNoTeamAccess } from 'models/team';
import { updateTimeOffPolicies } from 'models/timeOff';

const policySchema = z.object({
  allowances: z.object({
    VACATION: z.number().int().min(0).max(730).nullable(),
    SICK: z.number().int().min(0).max(730).nullable(),
    PERSONAL: z.number().int().min(0).max(730).nullable(),
    UNPAID: z.number().int().min(0).max(730).nullable(),
  }),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'PATCH');
      return res
        .status(405)
        .json({ error: { message: `Method ${req.method} Not Allowed` } });
    }

    const member = await throwIfNoTeamAccess(req, res);
    const { allowances } = validateWithSchema(policySchema, req.body);
    await updateTimeOffPolicies(member, allowances);
    return res.status(200).json({ data: {} });
  } catch (error: any) {
    return res.status(error.status || 500).json({
      error: { message: error.message || 'Something went wrong' },
    });
  }
}
