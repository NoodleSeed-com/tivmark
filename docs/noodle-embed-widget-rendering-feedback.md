# NoodleSeed feedback — embedded assistant does not render MCP App widgets

> For the NoodleSeed developers, from the Tivmark design-partner build (2026-07-17). **One sharp bug**:
> the same MCP App that renders widgets correctly in ChatGPT renders **only the data, never the widget**,
> in the embedded assistant (`@noodleseed/assistant`). This is isolated to the embed host/client, not the
> app. Everything below is backed by the shipped client code and by eliminating every app-side cause.

## TL;DR

The embedded-assistant browser client renders a widget **only when the widget `html` is inlined in the
turn stream's `view_available` event**. It never fetches the `ui://` resource itself. ChatGPT renders the
same widgets because, as a full MCP client, it calls `resources/read` to pull the widget HTML. So when the
service delivers the view event with `structuredContent` + `resourceUri` but no inline `html`, the embed
client shows the data and silently drops the widget.

**Fix (either one):** (1) service inlines widget `html` in the embed's `view_available` SSE event, or
(2) client fetches the `ui://` `resourceUri` via `resources/read` when `html` is absent.

## Environment

- Server SDK: `@noodleseed/one` **0.48.0**; deployed `noodleseed/tivmark-assistant/prod` **v13**, access
  `customers`, `interactions.confirmationFallback: 'host'`. 4 read widgets + 2 confirm-gated write result
  widgets (all `view: { component, entry }`, `domain: https://app.tivmark.com`, self-contained CSP).
- Embed client: `@noodleseed/assistant` **1.4.0** (React wrapper `NoodleAssistant`, backend
  `createAssistantSession`). Behavior **also verified against 1.5.0** — see §4.
- Hosts exercised: **ChatGPT developer mode** (widgets render ✅) vs **embedded assistant** on
  `app.tivmark.com` (data renders, widget does not ❌). Identical deployed server for both.

## 1. Symptom

In the embedded assistant, a tool that declares a `view` (e.g. `time_off_balance`, `my_equipment`, and the
`order_equipment` confirmed-result view) returns and the assistant shows the **textual/structured result**,
but the **widget iframe never appears**. The exact same server version, same tools, same widgets render
correctly in ChatGPT in-chat. Writes themselves succeed in both hosts (the 0.48
`confirmationFallback: 'host'` fix works — thank you); this is purely widget **rendering** in the embed.

## 2. Root cause (shipped client code)

The embed renders app widgets in `@noodleseed/assistant`'s `mountAssistantApp`:

```js
function mountAssistantApp(detail, actions) {
  if (!detail.html) return void 0;              // ← bails silently when html is absent
  const card = document.createElement("section");
  ...
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.srcdoc = PROXY_DOCUMENT;                 // proxy doc; real html injected via the bridge
  ...
  bridge.onsandboxready = () => bridge.sendSandboxResourceReady({ html: detail.html, ... });
}
```

The view-event validator `isViewAvailableDetail` requires `resourceUri` to start with `ui://` but treats
**`html` as optional**:

```js
function isViewAvailableDetail(value) {
  return hasString(value, "id") && hasString(value, "tool")
    && typeof value.resourceUri === "string" && value.resourceUri.startsWith("ui://")
    && hasOptionalString(value.title) && ...;   // html not required here
}
```

So the protocol allows a `view_available` event with only `resourceUri` (no `html`) — and in that case the
renderer bails. **There is no `resources/read` fallback in the render path**: the client never uses the
`resourceUri` to fetch the widget HTML. (The `resources/read` handlers that do exist in the bundle are the
`AppBridge.onreadresource` path — i.e. for the *widget iframe* to call back into the host — not for the host
to fetch the widget's own HTML.)

By contrast, ChatGPT is a full MCP client: it reads the `ui://` resource via `resources/read` and always
has the HTML, so it renders.

## 3. Why this is a platform/host issue, not an app issue — everything ruled out app-side

- **Not our CSP / security headers.** Production `app.tivmark.com` serves **no `Content-Security-Policy`
  and no `Cross-Origin-Embedder-Policy`/`Cross-Origin-Opener-Policy`** (verified via `curl -I`). The only
  frame-related header is `x-frame-options: SAMEORIGIN`, which **does not apply to `srcdoc` iframes**.
  Nothing app-side blocks the widget iframe.
- **Not an embed config we omitted.** `embeddedAssistant()` (`EmbeddedAssistantConfig`) exposes only
  `model`, `allowedOrigins`, `sessionClaims`, and UI layout/labels — **no widget/views/apps opt-in**. Our
  `/api/assistant/session` forwards the `createAssistantSession` response unchanged, including the advertised
  `endpoints.apps`. Widget delivery is automatic and is the service/client's responsibility.
- **Not the widget code.** The identical widget bundles render in ChatGPT.

## 4. A client version bump does NOT fix it

We diffed the installed **1.4.0** against **1.5.0**:

- `mountAssistantApp` and the `if (!detail.html) return` guard are **byte-identical** between the two.
- The render chunk differs only in unrelated error-handling (`session_expired`/`request_aborted`).
- The turn-stream chunk differs in 2 trivial lines (a `tool_proposed` validator gained optional
  `title`/`description`), nothing touching `html`/`resourceUri`/view rendering.

So upgrading the embed client will not deliver widgets; the change has to be in how `html` is delivered
or fetched.

## 5. Suggested fix (ranked)

1. **Client fetch-on-demand (preferred).** When a `view_available` event has a `ui://` `resourceUri` but no
   `html`, have the client `resources/read` that resource (it already holds an MCP session) and render the
   returned HTML — matching ChatGPT's behavior. This is the better design because each widget inlines its own
   ~207 KB React bundle (see the prior feedback's §C-2 on per-widget React), so **inlining every widget's
   HTML into every turn's SSE stream is wasteful**; fetch-on-demand keeps the turn stream small.
2. **Service inlines `html`.** Alternatively, always populate `detail.html` in the embed's `view_available`
   event (as ChatGPT effectively gets via `resources/read`). Simpler but heavier on the wire.
3. **At minimum, make it observable.** Today the client bails **silently** (`if (!detail.html) return`). It
   should surface a structured client event (e.g. `view_unavailable` with the `resourceUri` and reason) so an
   integrator can tell "widget suppressed / not delivered" from "no widget for this tool," instead of seeing
   a blank result and guessing. Ideally `noodle check`/docs also state that the embed client requires inline
   `html` (or note the fetch behavior once shipped).

## 6. Repro / how to confirm the payload

1. Deploy any `customers` app with a `view`-bearing read tool (e.g. `time_off_balance`). Embed via
   `<NoodleAssistant sessionEndpoint="/api/assistant/session" />`.
2. In ChatGPT: connect the same endpoint, run the tool → widget renders.
3. In the embed: run the tool → data renders, **no widget**.
4. Confirm in DevTools → Network → the assistant turn/SSE stream → the `view_available` event: it carries
   `resourceUri` (`ui://…`) and `structuredContent` but **no `html`** field. That absent `html` is what
   `mountAssistantApp` bails on.

## 7. Latent gotcha (heads-up, not the current cause)

Our `middleware.ts` defines a strict CSP including **`Cross-Origin-Embedder-Policy: require-corp`**, currently
disabled (`securityHeadersEnabled` off, which is why §3 shows no CSP in prod). If/when we enable security
headers, `require-corp` will very likely break the embed's sandboxed `srcdoc` widget iframe. A documented
statement of the CSP the embed requires (`frame-src`/`child-src`, COEP posture, sandbox flags) would let
integrators enable security headers without breaking the assistant.

---

**Bottom line:** the embed client renders widgets only from inline `html` and never fetches the `ui://`
resource that ChatGPT reads, so widgets silently don't render in the embedded assistant. Best fix is
client-side `resources/read` fetch-on-demand. This is the only blocker between "widgets work in ChatGPT" and
"widgets work everywhere Tivmark ships the assistant."
