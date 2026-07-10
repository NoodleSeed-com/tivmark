import type { Session } from 'next-auth';

const sessions = new WeakMap<object, Session>();
const teamMembers = new WeakMap<object, Record<string, unknown>>();

export const setLegacyApiContext = (
  request: object,
  session: Session,
  teamMember: Record<string, unknown>
) => {
  sessions.set(request, session);
  teamMembers.set(request, teamMember);
};

export const getLegacyApiSession = (request: object) => sessions.get(request);

export const getLegacyApiTeamMember = (request: object) =>
  teamMembers.get(request);
