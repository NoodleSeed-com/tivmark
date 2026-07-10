import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth/next';

import { getAuthOptions } from './nextAuth';
import { getLegacyApiSession } from './api/legacy-context';

export const getSession = async (
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
) => {
  const apiSession = getLegacyApiSession(req);
  if (apiSession) return apiSession;

  const authOptions = getAuthOptions(req, res);

  return await getServerSession(req, res, authOptions);
};
