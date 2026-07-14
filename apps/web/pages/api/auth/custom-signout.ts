import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions, sessionTokenCookieName } from '@/lib/nextAuth';
import { prisma } from '@/lib/prisma';
import { getCookie } from 'cookies-next';
import env from '@/lib/env';
import { deleteSession } from 'models/session';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authOptions = getAuthOptions(req, res);
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (env.nextAuth.sessionStrategy === 'database') {
      const sessionToken = await getCookie(sessionTokenCookieName, {
        req,
        res,
      });
      const sessionDBEntry = await prisma.session.findFirst({
        where: {
          sessionToken: sessionToken,
        },
      });

      if (sessionDBEntry) {
        await deleteSession({
          where: {
            sessionToken: sessionToken,
          },
        });
      }
    }

    // Clear the actual session cookie. In production (HTTPS) NextAuth uses the secure-prefixed name
    // `__Secure-next-auth.session-token`; hard-coding the unprefixed name left the session intact, so
    // sign-out never worked. `sessionTokenCookieName` resolves the correct name for the environment.
    const expired = (name: string) =>
      `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; SameSite=Lax${
        sessionTokenCookieName.startsWith('__Secure-') ? '; Secure' : ''
      }`;
    const securePrefix = sessionTokenCookieName.startsWith('__Secure-')
      ? '__Secure-'
      : '';
    res.setHeader('Set-Cookie', [
      expired(sessionTokenCookieName),
      expired(`${securePrefix}next-auth.callback-url`),
      // CSRF token uses the __Host- prefix when secure.
      `${securePrefix ? '__Host-' : ''}next-auth.csrf-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; SameSite=Lax${securePrefix ? '; Secure' : ''}`,
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    return res.status(500).json({ error: 'Failed to sign out' });
  }
}
