import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { validateWithSchema } from '@/lib/zod';
import { throwIfNoTeamAccess } from 'models/team';
import { createTimeOffRequest, getTimeOffWorkspace } from 'models/timeOff';

const requestSchema = z.object({
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.enum(['FULL_DAY', 'HALF_DAY']),
  halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const member = await throwIfNoTeamAccess(req, res);

    if (req.method === 'GET') {
      const year = Number(req.query.year || new Date().getUTCFullYear());
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(422).json({ error: { message: 'Invalid year.' } });
      }

      const workspace = await getTimeOffWorkspace(member, year);
      return res.status(200).json({ data: workspace });
    }

    if (req.method === 'POST') {
      const input = validateWithSchema(requestSchema, req.body);
      const request = await createTimeOffRequest(member, input);
      return res.status(201).json({ data: request });
    }

    res.setHeader('Allow', 'GET, POST');
    return res
      .status(405)
      .json({ error: { message: `Method ${req.method} Not Allowed` } });
  } catch (error: any) {
    return res.status(error.status || 500).json({
      error: { message: error.message || 'Something went wrong' },
    });
  }
}
