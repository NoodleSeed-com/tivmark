# NoodleSeed Embedded Assistant — Follow-up bug report (post-1.1.0)

> For the NoodleSeed developers. After you shipped `@noodleseed/assistant@1.1.0` /
> `@noodleseed/one@0.34.0` (the `gatewayUrl`/exports/engine fixes — thank you, all resolved on our
> side), we hit **two new, specific, reproducible bugs** while trying to (a) greet the signed-in user
> by name and (b) remove the tool-confirmation prompt. Both are almost certainly server/runtime-side.

## Environment

- `@noodleseed/one` **0.34.0**, `@noodleseed/assistant` **1.1.0**, `@noodleseed/agent-kit` 0.21.0
- Deployment: `noodleseed/tivmark-assistant/prod`, **version 2** (`tivmark-assistant-85204dc2`), access `customers`
- serviceUrl `https://cloud.noodleseed.dev`; origin `https://app.tivmark.com`

## Our server (`apps/assistant/src/server.ts`, deployed as v2)

```ts
export default server(
  'tivmark_assistant',
  {
    title: 'Tivmark Assistant',
    version: '1.0.0',
    auth: customerAuth.bridge({
      provider: 'tivmark-portal',
      user: { id: 'id', email: 'email', name: 'name', roles: 'roles' },
    }),
    assistant: embeddedAssistant({
      model: openAICompatible({ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-5', apiKey: secret('ASSISTANT_MODEL_API_KEY') }),
      allowedOrigins: ['https://app.tivmark.com'],
      layout: { mode: 'floating', position: 'bottom-right' },
    }),
  },
  [
    tool('greet', {
      description: 'Greet the currently signed-in user by name.',
      input: z.object({}),
      output: z.object({ message: z.string() }),
      annotations: annotations.readOnly(),
      fulfil: ({ user }) => ({ message: `Hello, ${user.name}!` }),
    }),
  ],
);
```

Our backend session exchange (`apps/web/pages/api/assistant/session.ts`) passes the signed-in
identity:

```ts
const assistantSession = await createAssistantSession({
  serviceUrl,          // https://cloud.noodleseed.dev
  clientId, clientSecret,
  origin,              // https://app.tivmark.com
  user: { id: session.user.id, email: session.user.email, name: session.user.name }, // e.g. name: 'Fahd Rafi'
});
```

The **compiled manifest is correct** (`noodle export manifest`):

```json
{
  "name": "greet",
  "description": "Greet the currently signed-in user by name.",
  "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false },
  "annotations": { "readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false },
  "fulfilment": { "steps": [], "output": { "message": "Hello, ${user.name}!" } }
}
```

`noodle check --target embedded-assistant` passes: *"Every model-visible tool carries annotations
used by the safe-read versus confirmation policy."*

---

## BUG 1 — Existing embed clients are pinned to the deployment version they were created against; they do NOT follow a later `noodle deploy`

**Impact (high):** you cannot update a live embedded assistant by redeploying. Our production portal
uses an `embed_…` client created against **v1**. After we `noodle deploy … --version 2`, the portal
**still serves v1's behavior**, even though `noodle inspect` reports v2.

### Evidence — same session helper, same user payload, two clients

**(a) Production client** (`embed_96855cee…`, created right after the v1 deploy) — a turn that calls `greet`:

```
POST {session.endpoints.turns}  body: {"message":"greet me"}
→ event: tool_proposed
  data: {"id":"confirm_…","tool":"greet","requiresConfirmation":true}    ← still confirm-gated (v1 had no annotation)

POST {session.endpoints.toolConfirmations}  body: {"id":"confirm_…"}
→ event: tool_completed
  data: {"id":"confirm_…","tool":"greet","result":{"message":"Hello, world!"}}   ← v1's input.name default "world"
```

`"Hello, world!"` can **only** come from the v1 manifest (`input: z.object({ name: z.string().default('world') })`,
`fulfil: ({input}) => 'Hello, ${input.name}!'`). v2 removed that input entirely. So this client is
executing the **v1 manifest**.

**(b) A brand-new client** created *after* the v2 deploy (`noodle assistant clients create`) — same helper,
same `user: { name: 'Fahd Rafi' }`:

```
POST {turns}  body:{"message":"Please invoke the greet tool. Do not ask, just call it."}
→ event: content data:{"delta":"It looks like the greeting came back without a name attached …"}
   (greet AUTO-RAN — no tool_proposed / no confirmation → readOnly IS honored on v2)
```

Meanwhile `noodle inspect --org noodleseed --app tivmark-assistant --env prod --json` reports the
**v2** surface for *both* clients:

```json
{"tools":[{"name":"greet","description":"Greet the currently signed-in user by name."}], …}
```

### Summary
- Client created under v1 → serves v1 manifest (confirm prompt, `input.name="world"`).
- Client created under v2 → serves v2 manifest (auto-run read-only, greets `user.name`).
- `noodle inspect` shows v2 for both → the *metadata/control-plane* advanced, but the **client's
  runtime manifest did not**.

### Confirmed workaround (the operational cliff)
To move production from v1 → v2 we had to: **(1) `noodle assistant clients create`** a fresh client
(the new one is v2-bound — verified: greet auto-runs, no confirmation), **(2) rotate the client
id+secret in our secret store**, and **(3) roll a new server revision** to pick them up. Re-running
`noodle deploy` alone did nothing for the existing client. `noodle assistant clients list` exposes no
version field and no command to advance a client in place.

### What we need
- Existing embed clients should follow the latest active deployment — or `rotate` should re-bind the
  client to the current manifest in place (same id, new secret), or add an explicit
  `noodle assistant clients advance`/`--deployment latest`. Requiring a new client + secret rotation +
  revision roll on **every** deploy is a hard operational cliff.

---

## BUG 2 — The customer identity passed to `createAssistantSession({ user })` never reaches the tool's `user` scope (`${user.name}` is empty)

**Impact (high):** greet-by-name is impossible. Even on a **v2** client (where greet auto-runs), the
result carries **no name**, despite us passing `user: { name: 'Fahd Rafi' }`.

### Evidence
- Session created with an explicit name:
  ```ts
  createAssistantSession({ serviceUrl, clientId, clientSecret, origin,
    user: { id: 'user-123', name: 'Fahd Rafi', email: 'fahd@tivmark.com' } })
  ```
- Server declares the bridge claim map: `customerAuth.bridge({ user: { id:'id', email:'email', name:'name', roles:'roles' } })`.
- Tool template (manifest): `"output": { "message": "Hello, ${user.name}!" }`.
- **Observed v2 result:** the greet output comes back with an empty name — the model narrates
  *"the greeting came back without a name attached, so I don't have a signed-in user's name"*.
  (On the v1-pinned client the same path yields `{"message":"Hello, world!"}` — i.e. it falls through
  to the v1 `input.name` default, never touching `user.name` either.)

### Diagnosis request
The chain **`createAssistantSession({ user })` → token claims → `customerAuth.bridge({ user: {...} })`
mapping → tool `ctx.user` symbolic scope** appears broken at one of those hops. `${user.name}`
resolves to empty. Please verify:
1. Does the session endpoint (`POST /v1/assistant/sessions`) actually embed the `user` fields as
   claims in the minted token?
2. Does `customerAuth.bridge({ user: { name: 'name' } })` map that claim into the tool `user` scope at
   runtime? (Is the mapping key/value orientation what we assume — `{ scopeField: 'claimName' }`?)
3. Is there anything additional we must declare for `ctx.user.name` to be populated in `fulfil`?

A one-line repro on your side: deploy the `greet` tool above, mint a session with
`user:{ name:'X' }`, call greet → expect `Hello, X!`, actual `Hello, !` (empty).

---

## Also worth a look (minor)

- **`noodle check --target embedded-assistant` gives false confidence.** It passes the "consent
  metadata" check purely because annotations are *present*, but on a v1-pinned client the tool still
  confirms. The check validates authoring, not the deployed client's actual behavior — a
  `noodle smoke`-style check that exercises the *live client/deployment* would have caught both bugs
  above.

## Current production state (as of this report)

`app.tivmark.com` is now cut over to a **v2-bound** client (`embed_78d7a6b6…`, via the workaround
above). So the live symptom is now the **v2** behavior:
- ✅ `annotations.readOnly()` works: greet **auto-runs, no Confirm/Cancel prompt**.
- ❌ BUG 2: greet returns an **empty name**.

**Live production screenshot** — user types `greet me`, the assistant responds:

> Hello there! 👋 It looks like your name wasn't returned by the system, but welcome! How can I help
> you today?

The model is paraphrasing a greet-tool result that came back with no name — even though the browser
session was for a signed-in user and our backend passed `user: { name: '<real name>' }` to
`createAssistantSession`. This is BUG 2, live.

(The earlier "Hello, world!" + Confirm screenshots were the **v1**-pinned client — BUG 1.)

## Net effect for a customer
After correctly authoring v2 (empty input, `annotations.readOnly()`, `Hello, ${user.name}!`),
validating, deploying, **and doing the client-rotation workaround**, the intended
"greet the signed-in user, no confirmation" is *half* working: the confirmation prompt is gone
(good), but the greeting has no name (BUG 2). Fixing **BUG 2** (customer identity → tool `user`
scope) is what makes greet-by-name actually work; fixing **BUG 1** removes the per-deploy client
rotation cliff.

## Positive note
`@noodleseed/one@0.34.0` added **`noodle assistant embed --framework nextjs`** (scaffolds the session
route + client-only mount + env) — exactly the scaffold we asked for in the first report. 👍 The two
bugs above are what remain between that scaffold and a working out-of-the-box embed.
