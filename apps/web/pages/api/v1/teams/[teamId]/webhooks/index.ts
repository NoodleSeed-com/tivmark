import { adaptLegacyTeamHandler } from '@/lib/api/legacy-adapter';
import { withIdempotency } from '@/lib/api/idempotency';
import handler from 'pages/api/teams/[slug]/webhooks';
export default withIdempotency(adaptLegacyTeamHandler(handler, 'webhooks'));
