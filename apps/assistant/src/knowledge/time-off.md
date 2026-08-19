# Time off in Tivmark

## Leave types

Tivmark tracks four types of leave:

| Type | Used for |
| :-- | :-- |
| `VACATION` | Planned holiday, drawn from the team's annual allowance |
| `SICK` | Illness, usually on a separate allowance from vacation |
| `PERSONAL` | Appointments, family matters, and other personal time |
| `UNPAID` | Approved leave taken without pay, typically uncapped |

Each type carries its own allowance per team, so a team can offer 25 vacation days and a
separate sick-leave pool without the two competing.

## Balances

A balance has three parts:

- **Allowance** — what the team grants for the year. A type can be *unlimited*, in which
  case there is no cap and Tivmark tracks usage without a remaining figure.
- **Used** — days already taken on approved requests.
- **Pending** — days on requests that are submitted but not yet reviewed. Pending days are
  held against the balance so two requests cannot quietly overspend the same allowance.

Remaining is allowance minus used minus pending. Tivmark counts in **half-days**, so a
morning off is 0.5 rather than a whole day.

## Booking leave

A request needs a leave type, a start date, and an end date. Dates are whole calendar
dates (`YYYY-MM-DD`); Tivmark resolves relative phrasing like "next Thursday" against the
requester's own time zone rather than the server's.

A new request starts as `PENDING`. It becomes `APPROVED` or `DECLINED` when a reviewer
acts on it. A requester can cancel their own request while it is still pending.

Booking leave is a confirmed action: Tivmark shows exactly what will be submitted — the
type, the dates, and the team — and waits for the person to confirm before anything is
created. That applies whether the request is made in the web app or through an assistant.

## Reviewing leave

Every team has a review queue holding its pending requests. Only team **owners** and
**admins** can review; members see their own requests but not the queue.

A reviewer approves or declines. Approving moves the pending days into used; declining
releases them back to the balance. Reviewers see the requester, the type, the dates, and
the balance the request draws against, so the decision does not need a separate lookup.

## Common questions

**Can I book leave that crosses a weekend or a holiday?** Yes. Tivmark records the range
you request; how non-working days are counted is a per-team policy setting.

**What happens if I run out of allowance?** The request can still be submitted, and the
reviewer sees that it exceeds the remaining balance. Teams that want a hard stop configure
it in their policy.

**Can I change a request after submitting it?** Cancel it and submit a new one. Tivmark
deliberately does not edit a request in place, so the approval always refers to exactly
what was reviewed.

**Who can see my leave?** Your own requests are yours. Team owners and admins see the
team's queue. Tivmark does not expose one member's leave to another member.
