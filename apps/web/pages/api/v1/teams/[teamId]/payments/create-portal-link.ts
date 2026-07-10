import { adaptLegacyTeamHandler } from '@/lib/api/legacy-adapter';
import handler from 'pages/api/teams/[slug]/payments/create-portal-link';
export default adaptLegacyTeamHandler(handler, 'billing');
