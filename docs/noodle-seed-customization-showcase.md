# Noodle Seed managed-customization showcase

Last verified: 2026-09-01

## Customer answer

Noodle Seed's managed assistant can feel like a Tivmark product without Tivmark owning a chat renderer. The useful boundary is:

| Layer                                | Customization within Noodle Seed                                                                                                                                                   | Tivmark showcase                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable identity                    | High: name, accent, light/dark surfaces, full semantic palette, themed logo, mark, avatar, typography class, radius, density, and color scheme                                     | Mark carries the Tivmark brand kit with the deployment                                                                                                  |
| Managed chat chrome                  | High but intentionally bounded: panel surface/elevation/border/radius, launcher style/icon/size/status/effect, header mark/badge, composer icons/shape, and message treatments     | Glass panel, dramatic elevation, strong border, branded pulsing launcher, live header badge, pill composer, accent user messages, and assistant bubbles |
| Layout and behavior                  | High: floating/inline/drawer baseline, position, dimensions, offsets, density, mobile fullscreen, launcher/header/avatar/timestamp/powered-by visibility, and interaction behavior | Floating public assistant, host-positioned signed-in drawer, fullscreen mobile, visible provenance, compact business confirmations                      |
| Exact website fit                    | High on a customer-owned site: typed light/dark appearance roles, public CSS tokens, supported slots, and appearance warnings                                                      | Tivmark supplies every major light/dark color role and its product typeface; only placement changes between the public site and app                     |
| Copy and entry points                | High: labels, loading/error/retry/sign-in/confirmation copy, locale/direction, and exact or generated starter prompts                                                              | Mark-specific states, public-to-signed-in copy, and four flagship prompts                                                                               |
| Structured experiences               | High: managed confirmations, requested-input forms, tool results, and sandboxed MCP Apps                                                                                           | Tivmark's onboarding, guide, review, and request cards render inside the same assistant                                                                 |
| Outer chrome in third-party AI hosts | Host-controlled                                                                                                                                                                    | The tools, guide, brand-aware content, and linked Apps travel; ChatGPT/Claude/Gemini still own their surrounding conversation UI                        |
| Arbitrary transcript markup/layout   | Requires Noodle's BYO UI path                                                                                                                                                      | Intentionally not used in this showcase                                                                                                                 |

This is the top end of the managed path. It uses no custom transcript, chat transport, internal shadow-DOM selector, injected HTML, inline SVG, or renderer callback. Public slots remain available, but are deliberately unused so the demo proves how far the standard product goes on configuration alone.

## Five-minute demo

1. Open `https://tivmark.com` in light mode. Start with the collapsed, large Tivmark-mark launcher. Point out its session status and subtle pulse: both are Noodle presentation settings, not a hand-built button.
2. Open Mark. Show the branded mark, “Ready to help” badge, Tivmark palette and typography, starter prompts, avatars, timestamps, and “Powered by Noodle Seed” provenance.
3. Select “Help me set up Tivmark for my business.” The assistant moves from ordinary conversation into Tivmark's structured onboarding experience without leaving the managed shell.
4. Toggle dark mode while the panel is open. Every major role changes together: canvas, panel, header, messages, composer, suggestions, confirmations, buttons, code, launcher, and embedded App frame.
5. Ask “Can I take next Friday off? If so, book it.” As a visitor, Mark raises the built-in branded sign-in card. Sign in or create an account; the same conversation resumes in the product.
6. In `https://app.tivmark.com`, show the same assistant as a push drawer. Tivmark changes placement with supported host tokens while Noodle still owns the transcript, streaming, tools, confirmations, errors, and accessibility.
7. Complete a safe write. The built-in confirmation shows the business-readable review and Tivmark action labels, while the technical connector disclosure stays hidden. Noodle still holds the proposed arguments server-side until acceptance.
8. Resize to mobile. The same managed assistant takes over fullscreen with no alternate implementation.

For a sales recording, capture steps 1–4 in one uninterrupted take, then steps 5–8 in a second authenticated take. The visual theme toggle and public-to-signed-in continuation communicate more platform leverage than a static gallery of color options.

## What changed for this showcase

- `@noodleseed/one` is current at `0.151.1`; `@noodleseed/assistant` is current at `1.31.0`.
- The Noodle agent guidance was refreshed from agent-kit `0.79.0` to `0.91.0`.
- `apps/assistant/src/server.ts` now declares the complete portable brand kit and the richest managed presentation, layout, behavior, labels, locale, and direction settings.
- `apps/web/lib/assistantAppearance.ts` remains the exact typed role map for the signed-in app.
- `apps/marketing/index.html` remains the public CSS-token map and now lets the managed 24px panel radius show through.
- `apps/web/styles/globals.css` and the marketing embed set the public Noodle typography token to Tivmark's Outfit family.

## Guardrails for future changes

- Prefer server `branding` and `presentation` first so identity travels with every compatible surface.
- Use typed `appearance` or documented `--ns-assistant-*` tokens for exact customer-site colors and placement.
- Use public slots only for small trusted host adornments; do not target internal shadow-DOM classes.
- Use MCP Apps for structured task experiences, not to recreate the transcript.
- Choose BYO UI only when the product genuinely requires arbitrary chat markup or interaction layout and is willing to own accessibility, rendering, and every message-part state.

Official references: [Embed an assistant in your SaaS](https://docs.noodleseed.dev/docs/guides/embedded-assistant) and [Bring your own UI](https://docs.noodleseed.dev/docs/guides/bring-your-own-ui).
