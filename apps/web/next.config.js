/* eslint @typescript-eslint/no-var-requires: "off" */
const path = require('path');
const fs = require('fs');
const { i18n } = require('./next-i18next.config');
const { withSentryConfig } = require('@sentry/nextjs');

const monorepoRoot = path.join(__dirname, '../..');
const outputFileTracingRoot = fs.existsSync(
  path.join(monorepoRoot, 'apps/web/package.json')
)
  ? monorepoRoot
  : __dirname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot,
  // @noodleseed/assistant ships ESM-only subpath exports (import/types, no require),
  // so Next must transpile it to down-level the compiled ESM for the browser target.
  transpilePackages: ['@noodleseed/assistant'],
  webpack: (config) => {
    // The package's exports map exposes only the `import` condition, which Next's server-side
    // resolution pass won't match ("Package path ./react is not exported"). Alias the two
    // subpaths straight to their dist files to bypass exports resolution. `$` = exact match.
    const assistantDist = (file) => {
      const candidates = [
        path.join(monorepoRoot, 'node_modules/@noodleseed/assistant/dist', file),
        path.join(__dirname, 'node_modules/@noodleseed/assistant/dist', file),
      ];
      return candidates.find((p) => fs.existsSync(p)) || candidates[0];
    };
    config.resolve.alias['@noodleseed/assistant/react$'] =
      assistantDist('react.js');
    config.resolve.alias['@noodleseed/assistant/server$'] =
      assistantDist('server.js');
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'boxyhq.com',
      },
      {
        protocol: 'https',
        hostname: 'files.stripe.com',
      },
    ],
  },
  i18n,
  rewrites: async () => {
    return [
      {
        source: '/.well-known/saml.cer',
        destination: '/api/well-known/saml.cer',
      },
      {
        source: '/.well-known/saml-configuration',
        destination: '/well-known/saml-configuration',
      },
      {
        source: '/oauth/authorize',
        destination: '/api/oauth-v1/authorize',
      },
      {
        source: '/oauth/token',
        destination: '/api/oauth-v1/token',
      },
      {
        source: '/oauth/revoke',
        destination: '/api/oauth-v1/revoke',
      },
      {
        source: '/oauth/userinfo',
        destination: '/api/oauth-v1/userinfo',
      },
      {
        source: '/oauth/jwks',
        destination: '/api/oauth-v1/jwks',
      },
      {
        source: '/oauth/.well-known/openid-configuration',
        destination: '/api/oauth-v1/discovery',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/oauth-v1/discovery',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*?)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains;',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

// Additional config options for the Sentry webpack plugin.
// For all available options: https://github.com/getsentry/sentry-webpack-plugin#options.
const sentryWebpackPluginOptions = {
  silent: true,
  hideSourceMaps: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
