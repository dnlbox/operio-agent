# Arize Evaluation Strategy

This document explains how Operio uses **Arize Phoenix** for live trace review and can optionally use **Arize AX** for repeatable dataset and experiment publishing.

## 1. What Arize Should Prove

We want judges to see three things:

1. **The agent reasons over ambiguity.**
   - Example: store-owned decorative lighting is failing, but the upstream electrical panel is landlord-owned.
   - The agent should separate fixture-level responsibility from supply-side responsibility instead of jumping to a simplistic answer.

2. **The agent handles non-maintenance conversations.**
   - Example: product launches, corridor queueing, crowd control, and event approvals.
   - The agent should interpret lease policy and approval workflow without forcing everything into a work order.

3. **The full conversational path is traceable and measurable.**
   - Each turn should carry session context, retrieval evidence, tool calls, and a resolution outcome so Arize can evaluate the conversation, not just the final answer.

## 2. What We Capture In Phoenix

Operio now emits Phoenix-friendly conversation structure at the chat-turn level:

- `session.id`
- tenant and lease identifiers
- turn number
- tool spans for lease search, manual search, staff lookup, and work-order actions
- turn tags such as:
  - `lease_reasoning`
  - `manual_diagnostics`
  - `lighting_power`
  - `event_ops`
  - `ambiguous_liability`
- turn resolutions such as:
  - `auto_dispatched`
  - `pending_approval`
  - `policy_guidance`
  - `guidance_only`
  - `duplicate_prevented`

This makes Phoenix useful for:

- **Tracing:** See the exact lease/manual/tool chain behind the answer.
- **Sessions:** Review full multi-turn tenant conversations as one unit.
- **Trace Evals:** Score whether a single turn reached the correct operational outcome.
- **Session Evals:** Score whether a whole conversation stayed coherent and reached resolution.

## 3. High-Value Evaluation Scenarios

These are the scenarios we should demo and score first:

### A. Lighting Demarcation
**Prompt:** "Our custom display lighting is flickering across two storefront zones and bulbs we replaced yesterday are already burning out again."

**What success looks like:**
- The agent cites the lease demarcation between store fixtures and landlord feeder/panel.
- It recognizes that repeated failures across multiple runs suggest a supply-side issue.
- It avoids overconfidently blaming only the tenant.
- It recommends the next diagnostic step before final liability assignment.

### B. Launch Event / Corridor Queue
**Prompt:** "We are planning a sneaker launch next Friday and expect a corridor line outside the store."

**What success looks like:**
- The agent does not create a maintenance work order.
- It cites the lease clause governing corridor queues and landlord approval.
- It explains the need for an event plan, queue control, and possible security or common-area restrictions.

### C. HVAC Over/Under Threshold
**Prompt pair:** routine HVAC fix under threshold vs. compressor replacement above threshold.

**What success looks like:**
- The agent distinguishes tenant maintenance from landlord-funded structural repair.
- It routes the low-cost case straight through.
- It sends the high-cost landlord-liable case to HITL approval.

### D. Duplicate Incident Prevention
**Prompt:** repeated leak or repeat complaint on an already-open issue.

**What success looks like:**
- The agent checks active work orders first.
- It references the existing work order instead of creating a duplicate.

## 4. Evaluators To Add

Phoenix supports trace/span scoring, LLM-based evaluations, human labels, datasets, experiments, and session-level evaluations.[Arize Phoenix overview](https://arize.com/docs/phoenix) It also supports grouping multi-turn conversations with `session.id` and evaluating coherence/resolution at the session level.[Phoenix sessions tutorial](https://arize.com/docs/phoenix/tracing/tutorial/sessions) Trace data can be exported, scored, and logged back into the UI for review.[Running evals on traces](https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces)

Recommended evaluators:

1. **Liability correctness**
   - Did the agent assign `Tenant`, `Landlord`, or `Unknown` correctly?

2. **Evidence usage**
   - Did the response cite the correct lease clause or manual section?

3. **Ambiguity handling**
   - Did the agent acknowledge uncertainty where demarcation is genuinely unclear?

4. **Workflow correctness**
   - Did the agent choose the right path: dispatch, pending approval, duplicate prevention, or policy-only guidance?

5. **Session coherence**
   - Did the model preserve context across follow-ups?

6. **Resolution quality**
   - Did the conversation end with a concrete next step instead of vague guidance?

## 5. How Judges Should See It

The most convincing live flow is:

1. Run the **lighting demarcation** prompt in the chat UI.
2. Open Phoenix and show the session-level trace with nested tool spans.
3. Point out that the agent searched both lease responsibility and diagnostics before deciding the issue was ambiguous.
4. Run the **launch event** prompt next.
5. Show that the agent answered with policy guidance instead of trying to create a work order.
6. In Phoenix, compare the two traces:
   - one operational incident with ambiguous liability
   - one non-maintenance conversation resolved through lease policy

That contrast is what proves reasoning depth.

## 6. Where AX Fits

Phoenix is the primary judge-facing surface during the live demo because it shows the real trace tree generated by the app. AX is the optional hosted layer for publishing the shared scenario baseline as a reusable dataset and experiment so outcomes can be compared across runs over time.

For the exact live-demo path, use [ARIZE_JUDGING_GUIDE.md](ARIZE_JUDGING_GUIDE.md).
