import type { NextApiRequest, NextApiResponse } from 'next';
import { oauthJwks } from '@/lib/api/oauth';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(await oauthJwks());
}
