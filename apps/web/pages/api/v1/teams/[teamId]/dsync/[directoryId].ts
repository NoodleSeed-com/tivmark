import { adaptLegacyTeamHandler } from '@/lib/api/legacy-adapter';
import handler from 'pages/api/teams/[slug]/dsync/[directoryId]';
export default adaptLegacyTeamHandler(handler, 'directory_sync');
