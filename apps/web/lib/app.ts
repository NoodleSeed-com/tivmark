import packageInfo from '../package.json';
import env from './env';

const app = {
  version: packageInfo.version,
  name: 'Tivmark Advisory',
  logoUrl: '/images/logo-horizontal-light.png',
  logoUrlDark: '/images/logo-horizontal-dark.png',
  markUrl: '/images/logo-mark-transparent.png',
  url: env.appUrl,
};

export default app;
