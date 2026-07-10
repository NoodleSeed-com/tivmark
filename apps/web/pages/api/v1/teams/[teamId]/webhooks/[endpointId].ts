import { adaptLegacyTeamHandler } from '@/lib/api/legacy-adapter';
import handler from 'pages/api/teams/[slug]/webhooks/[endpointId]';
export default adaptLegacyTeamHandler(handler, 'webhooks');
