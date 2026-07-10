import { adaptLegacyTeamHandler } from '@/lib/api/legacy-adapter';
import { withIdempotency } from '@/lib/api/idempotency';
import handler from 'pages/api/teams/[slug]/payments/create-checkout-session';
export default withIdempotency(adaptLegacyTeamHandler(handler, 'billing'));
