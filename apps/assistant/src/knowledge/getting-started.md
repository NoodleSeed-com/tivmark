# Getting started with Tivmark

## Setting up a workspace

1. **Create your workspace** at `app.tivmark.com` and confirm your email.
2. **Create your first team** and give it a name and slug. Most companies start with one
   team and split later as they grow.
3. **Set allowances** for the leave types the team offers — vacation, sick, personal, and
   unpaid. Any type can be unlimited.
4. **Invite people** by email, or connect SCIM so your directory does it for you.
5. **Assign reviewers** by making the right people owners or admins. A team with no
   reviewer has nobody who can approve requests, so do this before inviting members.

## First week

Have the team raise real requests rather than test ones. The queue is the part managers
judge Tivmark on, and it only reads properly with genuine traffic.

If you are migrating from a spreadsheet, enter the balances people have already used this
year as the starting position rather than trying to backfill individual historical
requests.

## Connecting single sign-on

SAML SSO is configured per workspace. You will need your identity provider's metadata URL
or certificate. Once SSO is on, you can require it for everyone or run it alongside
password sign-in during a transition.

SCIM is configured separately and handles provisioning: new starters get access without an
invite, and leavers lose it without anyone remembering to remove them.

## Using Tivmark with an AI assistant

Tivmark ships an assistant called **Mark**. Inside the product it acts as the signed-in
person — it can check a balance, book leave, request equipment, and, for owners and
admins, work the review queues. Anything that changes data asks for confirmation first.

Tivmark is also reachable from external AI hosts over the Model Context Protocol, so the
same capabilities work from other assistants after connecting the workspace.

## Getting help

- The assistant on this site answers product questions without an account.
- For questions about an existing workspace, use the contact details on the Tivmark site.
- For a walkthrough before committing, ask for a demo.
