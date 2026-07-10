import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { validateWithSchema } from '@/lib/zod';
import { throwIfNoTeamAccess } from 'models/team';
import {
  cancelTimeOffRequest,
  reviewTimeOffRequest,
  updateTimeOffRequest,
} from 'models/timeOff';

const requestFields = {
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.enum(['FULL_DAY', 'HALF_DAY']),
  halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
};

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update'), ...requestFields }),
  z.object({ action: z.literal('cancel') }),
  z.object({
    action: z.literal('review'),
    decision: z.enum(['APPROVED', 'DECLINED']),
    reviewNote: z.string().trim().max(500).nullable().optional(),
  }),
]);

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
    const requestId = z.string().uuid().parse(req.query.requestId);
    const input = validateWithSchema(actionSchema, req.body);

    if (input.action === 'cancel') {
      const request = await cancelTimeOffRequest(member, requestId);
      return res.status(200).json({ data: request });
    }

    if (input.action === 'review') {
      const request = await reviewTimeOffRequest(
        member,
        requestId,
        input.decision,
        input.reviewNote
      );
      return res.status(200).json({ data: request });
    }

    const request = await updateTimeOffRequest(member, requestId, input);
    return res.status(200).json({ data: request });
  } catch (error: any) {
    return res.status(error.status || 500).json({
      error: { message: error.message || 'Something went wrong' },
    });
  }
}
