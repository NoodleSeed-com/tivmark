import micromatch from 'micromatch';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import env from './lib/env';

// Constants for security headers
const SECURITY_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
} as const;

// Generate CSP
const generateCSP = (): string => {
  const policies = {
    'default-src': ["'self'"],
    'img-src': [
      "'self'",
      'boxyhq.com',
      '*.boxyhq.com',
      '*.dicebear.com',
      'data:',
    ],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      '*.gstatic.com',
      '*.google.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'connect-src': [
      "'self'",
      '*.google.com',
      '*.gstatic.com',
      'boxyhq.com',
      '*.ingest.sentry.io',
      '*.mixpanel.com',
    ],
    'frame-src': ["'self'", '*.google.com', '*.gstatic.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  return Object.entries(policies)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .concat(['upgrade-insecure-requests'])
    .join('; ');
};

// Add routes that don't require authentication
const unAuthenticatedRoutes = [
  '/',
  '/images/**',
  '/api/hello',
  '/api/health',
  '/api/openapi.json',
  '/api/v1/**',
  '/api/auth/**',
  '/api/oauth/**',
  '/api/oauth-v1/**',
  '/api/scim/v2.0/**',
  '/api/invitations/*',
  '/api/webhooks/stripe',
  '/api/webhooks/dsync',
  '/auth/**',
  '/oauth/**',
  '/oauth/.well-known/openid-configuration',
  '/.well-known/oauth-authorization-server',
  '/invitations/*',
  '/terms-condition',
  '/unlock-account',
  '/login/saml',
  '/.well-known/*',
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/v1/') && req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    const response = new NextResponse(null, { status: 204 });
    if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Idempotency-Key'
    );
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    response.headers.set('Access-Control-Max-Age', '600');
    return response;
  }

  // Bypass routes that don't require authentication
  if (micromatch.isMatch(pathname, unAuthenticatedRoutes)) {
    return NextResponse.next();
  }

  const redirectUrl = new URL('/auth/login', env.appUrl);
  const callbackUrl = new URL(`${pathname}${req.nextUrl.search}`, env.appUrl);
  redirectUrl.searchParams.set('callbackUrl', callbackUrl.toString());

  // JWT strategy
  if (env.nextAuth.sessionStrategy === 'jwt') {
    const token = await getToken({
      req,
    });

    if (!token) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Database strategy
  else if (env.nextAuth.sessionStrategy === 'database') {
    const url = new URL('/api/auth/session', req.url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
    });

    const session = await response.json();

    if (!session.user) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  const requestHeaders = new Headers(req.headers);
  const csp = generateCSP();

  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (env.securityHeadersEnabled) {
    // Set security headers
    response.headers.set('Content-Security-Policy', csp);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // All good, let the request through
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/session).*)'],
};
