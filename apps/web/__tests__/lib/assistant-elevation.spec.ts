import {
  ASSISTANT_SIGN_IN_TICKET_COOKIE,
  classifySignInRefusal,
  clearSignInTicketCookie,
  signInTicketCookie,
  takeSignInTicket,
} from '../../lib/assistant/elevation';

const request = (cookies: Record<string, string>, host = 'app.tivmark.com') =>
  ({ cookies, headers: { host } }) as any;

const response = () => {
  const headers: Record<string, unknown> = {};
  return {
    headers,
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: unknown) => {
      headers[name] = value;
    },
  } as any;
};

describe('assistant sign-in ticket', () => {
  it('is scoped to the parent domain so app.tivmark.com receives it', () => {
    const cookie = signInTicketCookie('tkt_1', 'tivmark.com');

    expect(cookie).toContain(`${ASSISTANT_SIGN_IN_TICKET_COOKIE}=tkt_1`);
    expect(cookie).toContain('Domain=.tivmark.com');
    expect(cookie).toContain('Secure');
    // A top-level GET navigation, so Lax is correct and None would be needlessly permissive.
    expect(cookie).toContain('SameSite=Lax');
  });

  it('stays host-only off the tivmark domain, so local development still works', () => {
    const cookie = signInTicketCookie('tkt_1', 'localhost:4002');

    expect(cookie).not.toContain('Domain=');
    // Secure would make the cookie unusable over plain-HTTP localhost.
    expect(cookie).not.toContain('Secure');
  });

  it('reads the ticket and clears it in the same response', () => {
    const res = response();
    const ticket = takeSignInTicket(
      request({ [ASSISTANT_SIGN_IN_TICKET_COOKIE]: 'tkt_1' }),
      res
    );

    expect(ticket).toBe('tkt_1');
    expect(String(res.getHeader('Set-Cookie'))).toContain('Max-Age=0');
  });

  it('preserves a Set-Cookie the route had already written', () => {
    const res = response();
    res.setHeader('Set-Cookie', 'other=1; Path=/');

    takeSignInTicket(
      request({ [ASSISTANT_SIGN_IN_TICKET_COOKIE]: 'tkt_1' }),
      res
    );

    const cookies = res.getHeader('Set-Cookie') as string[];
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toBe('other=1; Path=/');
    expect(cookies[1]).toContain('Max-Age=0');
  });

  it('writes no cookie header when there is no ticket', () => {
    const res = response();

    expect(takeSignInTicket(request({}), res)).toBeUndefined();
    expect(res.getHeader('Set-Cookie')).toBeUndefined();
  });

  it('clears with the same domain scope it was set with', () => {
    expect(clearSignInTicketCookie('tivmark.com')).toContain(
      'Domain=.tivmark.com'
    );
    expect(clearSignInTicketCookie('localhost:4002')).not.toContain('Domain=');
  });
});

describe('sign-in refusal handling', () => {
  it('treats an expired ticket as an ordinary event, not an error', () => {
    // The visitor took too long. They still get an assistant, just a fresh conversation.
    expect(classifySignInRefusal('elevation_ticket_expired')).toEqual({
      kind: 'retry-fresh',
      reason: expect.stringContaining('too long'),
    });
  });

  it('escalates a tenant mismatch instead of retrying it', () => {
    // A client reaching for a conversation it does not own is a boundary event. Retrying it
    // would be both useless and exactly the wrong response.
    const handling = classifySignInRefusal('elevation_tenant_mismatch');

    expect(handling?.kind).toBe('alert');
  });

  it('recovers a fresh conversation from every non-boundary refusal', () => {
    const codes = [
      'elevation_ticket_invalid',
      'elevation_ticket_expired',
      'elevation_already_signed_in',
      'elevation_session_unavailable',
    ];

    expect(
      codes.map((code) => [code, classifySignInRefusal(code)?.kind])
    ).toEqual(codes.map((code) => [code, 'retry-fresh']));
  });

  it('does not classify an unrelated failure as a sign-in refusal', () => {
    // e.g. `elevation_unavailable`, which the service returns as a 503 deliberately outside
    // the refusal union: that one pages an operator rather than degrading a visitor.
    expect(classifySignInRefusal('elevation_unavailable')).toBeUndefined();
    expect(classifySignInRefusal('something_else')).toBeUndefined();
  });
});
