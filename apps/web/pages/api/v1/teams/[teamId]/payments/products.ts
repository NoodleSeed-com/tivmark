import { adaptLegacyTeamHandler } from '@/lib/api/legacy-adapter';
import handler from 'pages/api/teams/[slug]/payments/products';
export default adaptLegacyTeamHandler(handler, 'billing');
