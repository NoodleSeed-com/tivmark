import type { NextApiRequest, NextApiResponse } from 'next';
import { oauthMetadata } from '@/lib/api/oauth';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(oauthMetadata);
}
