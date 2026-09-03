# Capability asks for complex, research-assisted B2B SaaS onboarding

> A scenario-led product brief for the Noodle Seed team

## Purpose of this document

We want to demonstrate that a genuinely complicated B2B SaaS onboarding process can feel simple,
guided, and safe when it is delivered through Noodle Seed.

This document deliberately describes **why we need each capability, the scenario it should enable,
and the outcome we need to observe**. It does not prescribe a specific SDK shape, runtime
architecture, storage model, user interface, or provider integration. We would like the Noodle Seed
team to use its judgment about the most horizontal way to provide these capabilities.

Our goal is not to ask Noodle Seed to encode our onboarding process. We want reusable foundations
that could support onboarding, implementation, migration, procurement, vendor review, due diligence,
and similar multi-step SaaS journeys across many industries.

## The scenario we are trying to enable

Imagine that a customer is adopting a sophisticated B2B SaaS product. Reaching production may
require all of the following:

1. Verify the organization and identify its business context.
2. Understand goals, stakeholders, constraints, and success criteria.
3. Research the company, its market, competitors, customers, and public technology footprint.
4. Invite security, legal, IT, data, and business stakeholders into different parts of the process.
5. Complete security, privacy, residency, and retention reviews.
6. Configure SSO, user provisioning, permissions, integrations, and delegated authentication.
7. Inventory data sources, map fields, estimate migration scope, and validate samples.
8. Propose product configuration based on collected and researched information.
9. Review and approve consequential changes before writing to authoritative systems.
10. Run a pilot, resolve blockers, obtain launch approval, and produce a durable completion record.

Some work can finish immediately. Some work may take hours or weeks. Some work belongs to the end
user, some to another employee, some to the SaaS vendor, and some to an external system. Research may
be performed by web-search or search-grounded AI providers such as OpenAI, Perplexity, or a
customer-selected alternative.

The desired experience is that Noodle Seed understands the current state, does safe work in the
background, asks the user only for information or decisions that are still needed, and always makes
the next action clear. The process can be complex without feeling chaotic.

## Product boundary we believe is important

The SaaS application should remain responsible for:

- Its business-specific questions and definition of onboarding success.
- Its domain data models, validation rules, permissions, and authoritative APIs.
- Its legal basis, customer agreements, and business-specific retention requirements.
- The meaning of each approval and the consequences of each product action.

We hope Noodle Seed can provide the reusable execution, evidence, governance, interaction, and
operational capabilities around those business rules. This boundary would let builders compose their
own journeys without requiring Noodle Seed to become a universal CRM, workflow product, or onboarding
application.

## Capability asks

### Cross-cutting addition: honor the customer's funding and evidence-reuse constraints

**Why we need it:** A SaaS builder may have substantial credits and governance already attached to
an existing cloud account. Requiring a separate model-provider key or billing relationship can make
an otherwise compelling workflow impractical. Equally, a provider's ability to return citations does
not imply permission to store, share, transform, or reuse those findings in an onboarding database.

**Scenario to enable:** Our onboarding analysis uses Gemini Flash through the customer's existing
Google Cloud billing project with workload identity, while the conversation and workflow remain
portable. We want to save reviewed company context for a team without accidentally applying a
search provider's chat-display license to a durable shared business record. A deployment can choose
public-site analysis today and a separately approved broad-search source later.

**We would consider this successful when:** Funding account, execution identity, provider/model,
data destination, allowed source scope, retention, and reuse rights can be understood before work
begins. Unsupported combinations fail clearly; no silent provider fallback or fabricated coverage
occurs. We do not require Noodle Seed to create cloud-specific business logic or offer legal advice.
We need a horizontal way to honor these deployment policies and preserve their context with the job.

This concern arose during implementation: [Google Search grounding's service-specific terms](https://cloud.google.com/terms/service-terms)
contain restrictions relevant to persistent reuse. We chose explicit public-site analysis via
[Gemini URL context](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/url-context)
for the initial implementation, not broad Google Search. Google Cloud credits remain subject to
the customer's grant eligibility; we are not treating credits as a guarantee of zero cost.

### 1. Let a customer journey survive beyond one conversation or tool call

**Why we need it:** Real B2B onboarding rarely completes in one sitting. A customer may start before
creating an account, continue after authentication, return several days later, or resume from a
different device or supported AI client. Treating each conversation as an isolated interaction makes
the user repeat information and forces the SaaS application to reconstruct the journey manually.

**Scenario to enable:** A visitor begins an onboarding assessment anonymously, signs up, completes
two configuration activities, waits for an administrator to configure identity, and returns a week
later. The experience continues from the correct point without treating signup as approval or losing
the earlier work.

**We would consider this successful when:** The user can stop and resume safely; completed work is
not repeated; pending work is still visible; identity transitions do not grant unintended authority;
and the application can determine which durable journey the current interaction belongs to.

### 2. Make a complicated plan understandable without exposing all of its complexity at once

**Why we need it:** A sophisticated onboarding may have dependencies, optional branches, parallel
work, prerequisites, blockers, deadlines, and completion criteria. The user should see a coherent
path and the next useful action rather than a flat checklist or a large form.

**Scenario to enable:** Security review and data mapping can run in parallel, SSO work appears only
for eligible plans, migration validation waits for a sample import, and production launch remains
blocked until required approvals are complete.

**We would consider this successful when:** Noodle Seed can help the application present what is
done, what is underway, what is blocked, why it is blocked, what can happen in parallel, and what the
user should do next. The application should define the business rules; Noodle Seed should make the
resulting journey coherent and resumable.

### 3. Support work that belongs to different people and organizations

**Why we need it:** The person who buys a B2B product is often not the person who configures identity,
answers security questions, signs legal terms, maps data, or approves launch. An assistant cannot
finish onboarding merely by keeping one person in a chat.

**Scenario to enable:** The project owner delegates SSO setup to an IT administrator, a security
questionnaire to a security reviewer, and launch approval to an executive sponsor. Each participant
should receive only the context and authority needed for their task, while the original owner can see
overall progress.

**We would consider this successful when:** Work can be assigned or handed off securely; the recipient
can complete it without receiving unrelated customer data; completion returns to the original
journey; reminders and escalation can occur without creating duplicate work; and ownership changes
are visible in the audit history.

### 4. Make long-running external and AI work a normal part of the journey

**Why we need it:** Deep research, document analysis, imports, security scans, provisioning, and
third-party approvals may take far longer than an interactive model turn. A brittle synchronous call
creates timeouts, duplicate work, and a poor user experience.

**Scenario to enable:** The assistant starts a bounded company-and-market research activity, allows
the user to continue other onboarding steps, reports meaningful progress, and returns when the result
is ready or when human input is needed.

**We would consider this successful when:** Long-running work can be started once, observed, cancelled,
retried according to policy, and resumed after interruption. Late or duplicate completion signals
must not apply the same result twice, and the user should never need to keep a chat window open while
the work runs.

### 5. Let applications request research without committing their product to one provider

**Why we need it:** Search and search-grounded AI providers expose different combinations of raw
results, citations, filtering, structured outputs, background execution, regional controls, and cost
information. SaaS builders may need to change providers because of customer policy, geography,
quality, availability, or commercial terms.

**Scenario to enable:** The same onboarding journey can research an organization through an approved
provider chosen by the customer or deployment policy. The application receives a predictable result
while still being able to understand important provider-specific limitations.

**We would consider this successful when:** Business logic does not have to be rewritten to change an
approved provider; unsupported requirements are reported before or during execution rather than
silently ignored; provider and model identity remain visible; and switching or combining providers is
an explicit, auditable decision.

### 6. Preserve evidence, uncertainty, disagreement, and freshness

**Why we need it:** A generated summary is not an authoritative business fact. Search results can be
stale, contradictory, incomplete, or based on secondary sources. If research is going to prefill an
onboarding answer or influence configuration, the user and the SaaS need to know why the claim was
made.

**Scenario to enable:** Research suggests the customer's headquarters, employee range, industry,
identity provider, and public compliance claims. The onboarding experience shows the supporting
sources, flags disagreement, distinguishes sourced facts from model inference, and leaves unknown
information unknown.

**We would consider this successful when:** Material claims can be traced to their sources; retrieval
and publication dates are retained; contradictions and missing evidence are visible; stale findings
can be revalidated; and downstream actions can require a specified level of evidence. We prefer
descriptions such as “corroborated,” “single source,” “conflicting,” or “unverified” over an apparently
precise but unexplained confidence score.

### 7. Enforce the purpose and boundaries of research outside the model prompt

**Why we need it:** Research about a public company is different from research about an individual.
The permitted sources, data classes, geography, retention period, and allowed downstream use may
differ by customer and purpose. Prompt instructions alone are not a sufficient control for sensitive
or consequential uses.

**Scenario to enable:** Public organization research is allowed for onboarding personalization, but
research about a person is disabled by default. If a customer has a legitimate approved use, the
journey can require an authenticated requester, declared purpose, appropriate notice or consent,
restricted sources, prohibited attributes, short retention, and human review.

**We would consider this successful when:** The runtime can refuse work that violates policy; a result
records the policy under which it was produced; sensitive traits and prohibited inferences can be
excluded; retention and deletion obligations can be honored; and general web or LLM research cannot
silently become an automated employment, credit, eligibility, or other consequential decision.

This boundary matters because employment background information can trigger legal and accuracy
obligations, and automated decisions about people may create additional discrimination and data
protection risk. We do not expect Noodle Seed to decide each customer's legal basis, but we do need a
reliable place for the SaaS to enforce its policy.

### 8. Keep researched findings separate from authoritative customer data

**Why we need it:** Research is useful for reducing manual input, but it should not silently become
truth in a system of record. A suggested company attribute, integration, competitor, or compliance
status may be wrong even when it is plausibly written.

**Scenario to enable:** Research proposes a company profile and recommended configuration. The user
reviews the supported findings, corrects anything necessary, and explicitly accepts the information
that should be promoted into the customer record.

**We would consider this successful when:** Research remains provisional until a business-defined
review condition is satisfied; accepted facts retain their provenance and reviewer; rejected or
superseded findings remain explainable; and a model cannot bypass the transition from evidence to
authoritative data.

### 9. Make consequential system changes reviewable and safe

**Why we need it:** Onboarding eventually performs real actions: create a workspace, configure roles,
connect an identity provider, import data, invite users, or enable production. A friendly conversation
must not obscure the scope of those changes.

**Scenario to enable:** The assistant prepares a proposed workspace configuration using user inputs
and approved research. The administrator sees a clear summary of what will change, any warnings, and
the systems affected before granting confirmation. The final response is based on the authoritative
API result.

**We would consider this successful when:** Proposed changes can be validated and reviewed before
execution; approval has a clear actor, scope, and expiration; repeated delivery does not duplicate the
action; partial failure cannot be presented as success; and the journey receives a durable receipt
from the system that actually performed the change.

### 10. Recover cleanly when only part of the journey succeeds

**Why we need it:** Multi-step onboarding inevitably encounters expired credentials, unavailable
providers, invalid customer data, incomplete imports, denied approvals, and changed prerequisites.
Restarting the entire journey is painful and can duplicate external effects.

**Scenario to enable:** An integration authenticates successfully, an import validates, and a later
configuration action fails. The customer fixes the issue and resumes from the failed boundary without
repeating authentication or import work that remains valid.

**We would consider this successful when:** The application can distinguish retryable failure,
terminal failure, cancellation, expiration, and “waiting for input”; successful work remains durable;
retries are bounded and safe; corrective action is understandable; and rollback or compensating work
can be represented when the SaaS supports it.

### 11. Bound cost, time, and resource consumption

**Why we need it:** Agentic search and deep research can issue many queries, consult many sources, and
run for minutes. An onboarding feature cannot have unbounded cost or latency, particularly when many
customers run it concurrently.

**Scenario to enable:** A SaaS chooses a fast, inexpensive lookup for a low-risk prefill and a deeper
investigation for a security or market assessment. Each activity has explicit limits and useful
behavior when those limits are reached.

**We would consider this successful when:** The application can constrain spend, queries, sources,
tool calls, duration, and concurrency; usage is attributable to the correct journey and tenant; work
stops predictably at its limit; and a partial result is labeled honestly instead of being presented as
complete.

### 12. Give users a portable experience across hosts and surfaces

**Why we need it:** The same Noodle Seed product may run in an embedded SaaS assistant, ChatGPT,
another MCP host, or a text-only client. Rich progress, evidence review, handoff, and approval
experiences should improve the interaction without making the underlying process unusable elsewhere.

**Scenario to enable:** An embedded user sees a compact progress view and evidence review surface. A
user in a host with fewer interactive capabilities receives a concise textual summary and a secure
handoff for the same required decision.

**We would consider this successful when:** Builders can understand host limitations before shipping;
every critical action has a safe fallback; unsupported interaction features fail clearly rather than
silently; and the business journey has the same authority and safety boundaries on every surface.

### 13. Make the full journey observable and auditable

**Why we need it:** When a process crosses users, providers, models, connectors, and days, neither the
customer nor the SaaS support team can troubleshoot it from the latest chat message alone. Research
also needs provenance and cost attribution.

**Scenario to enable:** A support operator can determine why onboarding is blocked, which provider and
model performed a research activity, what sources were consulted, what policy applied, who approved a
change, how much the activity cost, and whether a later retry changed the result.

**We would consider this successful when:** There is a redaction-safe lifecycle history with stable
identifiers, timestamps, actors, state transitions, provider and model versions, usage, cost, and
action receipts. Diagnostic information must respect tenant isolation and avoid turning logs into an
uncontrolled copy of sensitive research data.

### 14. Make these patterns reusable without turning them into a rigid workflow product

**Why we need it:** Many SaaS companies need the same operational patterns but have different domain
steps. If every builder independently recreates persistence, research governance, human review, and
recovery, integrations will behave inconsistently and take much longer to ship.

**Scenario to enable:** A builder can use the same Noodle Seed foundations for customer onboarding,
vendor due diligence, implementation planning, and migration readiness, while supplying different
questions, policies, APIs, and completion rules for each product.

**We would consider this successful when:** The reusable pieces compose cleanly; domain-specific data
does not leak into the platform abstraction; applications can package proven journey patterns; and a
builder can begin from a reference experience without being trapped by it.

### 15. Let builders prove the difficult cases before production

**Why we need it:** The happy path is not the risky part of research-assisted onboarding. The highest
risk lies in stale or conflicting sources, provider capability differences, resumability, duplicate
signals, authorization changes, partial failure, and attempted writes without approval.

**Scenario to enable:** Before deployment, a builder exercises synthetic cases in which a provider
times out, two sources disagree, a cost limit is exhausted, a participant lacks permission, an old
callback arrives twice, or a model attempts to promote an unreviewed finding.

**We would consider this successful when:** These situations can be simulated deterministically;
expected policy and state transitions can be asserted; provider adapters can be tested without live
spend; and validation identifies unsupported combinations before the journey reaches a customer.

## How these asks should improve the customer experience

With the capabilities above, Noodle Seed should be able to turn a complicated process into a simple
series of well-timed interactions:

- Prefill what can be supported by trustworthy evidence.
- Ask only for facts that remain missing, conflicting, or require customer authority.
- Run independent work in parallel.
- Send specialized tasks to the right stakeholder.
- Explain blockers and the next useful action.
- Let users inspect sources and correct assumptions.
- Require explicit review before consequential changes.
- Resume after delays, authentication, or device changes.
- Finish with an authoritative receipt and a clear operational handoff.

The measure of success is not that onboarding has fewer legitimate requirements. It is that the user
does not have to understand or manually coordinate all of them.

## Suggested delivery priorities

We would value the Noodle Seed team's judgment on sequencing. From the perspective of the scenario,
the following order would unlock useful demonstrations incrementally:

### First: a trustworthy end-to-end slice

- A journey can persist and resume.
- One bounded research activity can run asynchronously.
- Its result contains inspectable evidence and honest unknowns.
- A human can review the proposed findings.
- An approved change can be applied once and return an authoritative receipt.
- Policy, budget, and lifecycle history are enforced throughout.

### Next: real B2B coordination

- Parallel and conditional work can be represented.
- Work can be assigned securely across stakeholder roles.
- Delays, reminders, expiration, and external completion signals are handled.
- Failure can be repaired without replaying already successful work.

### Then: ecosystem breadth and product polish

- Multiple research providers can participate without rewriting business logic.
- Provider capabilities and limitations are visible before production.
- Rich progress, evidence, blocker, approval, and receipt experiences work across hosts with safe
  fallbacks.
- Reference journeys and deterministic evaluations help builders adopt the patterns correctly.

## What we are intentionally not asking for

We are not asking Noodle Seed to:

- Build an onboarding product specific to one SaaS company.
- Define a universal customer, company, competitor, or employee schema.
- Decide whether a particular customer has a lawful basis to research a person.
- Treat model-generated summaries as authoritative facts.
- Add a provider-specific research API to the horizontal core.
- Become a general-purpose BPMN or project-management system.
- Replace the SaaS application's authorization, validation, or system-of-record API.

We are asking for a reliable horizontal substrate on which those applications can build their own
governed, research-assisted journeys.

## Questions for the Noodle Seed team

We would appreciate guidance on:

1. Which parts of this scenario are already supported, including the recommended composition pattern?
2. Which parts are intentionally outside Noodle Seed's product boundary?
3. Where do you see the smallest horizontal abstractions that could unlock the largest portion of the
   scenario?
4. How should builders model durable state, external signals, and resumability today?
5. How should a provider-neutral research result preserve evidence and provider-specific fidelity?
6. Which governance controls belong in Noodle Seed versus the SaaS application?
7. What host limitations affect progress, evidence review, approvals, or long-running work?
8. What reference examples and evaluation tools could make this safe to implement on the first pass?

## External context supporting the scenario

The underlying provider ecosystems already expose many useful raw capabilities, but with different
contracts. OpenAI supports web-search citations, source inclusion, domain restrictions, and
background execution for longer work through its Responses API. Perplexity offers raw ranked search
results as well as synthesized and deep-research modes with citations and usage information. This is
why we believe a provider-neutral application experience is valuable while provider capability and
provenance must remain visible.

- [OpenAI web search guide](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Perplexity Search API](https://docs.perplexity.ai/docs/search/quickstart)
- [Perplexity deep research](https://docs.perplexity.ai/docs/sonar/models/sonar-deep-research)
- [Perplexity prompting and citations](https://docs.perplexity.ai/docs/sonar/prompt-guide)

Research involving people needs additional care. The following sources illustrate why purpose,
accuracy, human review, and consequential-decision boundaries need to be enforceable rather than
being left only to model instructions:

- [US FTC background-check guidance](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know)
- [US EEOC guidance on algorithmic employment tools](https://www.eeoc.gov/newsroom/us-eeoc-and-us-department-justice-warn-against-disability-discrimination)
- [European Commission guidance on individual data-protection rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en)

These references provide context, not legal advice. Each SaaS remains responsible for determining its
own legal and policy requirements.
