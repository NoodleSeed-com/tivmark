import type { NextApiRequest, NextApiResponse } from 'next';

import { requireApiPrincipal } from '@/lib/api/auth';
import { getOpenApiDocument } from '@/lib/api/openapi';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    await requireApiPrincipal(req, res);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(getOpenApiDocument());
  } catch (error: any) {
    return res.status(error.status || 401).json({
      type: 'https://tivmark.com/problems/unauthorized',
      code: 'unauthorized',
      title: 'Authentication required',
      status: error.status || 401,
      detail: error.message || 'Unauthorized',
    });
  }
}
