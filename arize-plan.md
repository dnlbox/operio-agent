# Operio Agent — Arize Track: Jury Assessment & Execution Plan

> Google Cloud Rapid Agent Hackathon · Submission deadline **June 11, 2026, 2:00 PM PDT** · ~3 days remaining as of June 8.
> Selected track: **Arize** (observability, LLM tracing, evaluators).

---

## 1. Jury Panel Assessment

Three independent judge personas evaluated the repository against the official rubric
(Technological Implementation · Design & UX · Potential Impact · Quality of the Idea).

### Scores

| Criterion (1–10)             | GCP Partner Eng          | Arize Solutions           | Elastic/Mongo PM |
| ---------------------------- | ------------------------ | ------------------------- | ---------------- |
| Technological Implementation | 6                        | 5                         | 6                |
| Design & UX                  | 7                        | 4                         | 9                |
| Potential Impact             | 7                        | 6                         | 7                |
| Quality of the Idea          | 8                        | 6                         | 8                |
| **Track verdict**            | Elastic authenticity gap | **Not competitive as-is** | Pivot to MongoDB |

### Consensus findings

- **Idea and UX are top-quartile**; the **runtime / data layer underdelivers** against the rubric.
- The **idea (8/8/8) and UX (9) are already winning-grade**. The gap is entirely runtime + compliance, not concept.

### Cross-cutting blockers (hit every track)

1. **No live hosted agent.** `.github/workflows/deploy-pages.yml:34` publishes `docs/` — a static
   documentation page. The real SPA (`demo/`) calls `localhost:3001` with no public backend. No Cloud
   Run / Agent Engine deployment exists. A judge opening the submission URL cannot use the product.
   _(Organizer-flagged disqualifier #2.)_
2. **Google Cloud Agent Builder is not the provable default.** Default `reasoning_backend="legacy"`
   (`agents/operio_agent/config.py:30`) runs a hand-rolled Gemini loop on a direct AI-Studio key — using
   no Google Cloud. ADK is used only via local `InMemoryRunner` (`brain.py:202`); there is no Vertex AI
   Agent Engine deployment. `google-cloud-aiplatform` is declared but never imported.
   _(Organizer-flagged disqualifier #1.)_
3. **Custom MCP servers, not the partner's.** `mcp_servers/*.ts` are bespoke `@modelcontextprotocol/sdk`
   reimplementations, not the official Elastic/MongoDB/Arize MCP servers.

### Arize-specific findings (the deciding ones)

- **The Arize MCP server is not used.** Zero references to `@arizeai/phoenix-mcp`, Arize AX, or the
  `arize` SDK anywhere. Only self-hosted Phoenix OTel tracing
  (`arize-phoenix`, `openinference-instrumentation-google-genai`). Per the track brief this is "merely
  emit traces" — the explicitly disqualifying case.
- **All 6 evaluators are aspirational.** `docs/ARIZE_EVALS.md` lists Liability correctness, Evidence
  usage, Ambiguity handling, Workflow correctness, Session coherence, Resolution quality. None exist in
  code. `session_analysis.py` does keyword heuristics, not LLM-as-judge. `agents/tests/evaluate_brain.py`
  is a mocked pytest accuracy gate, not a Phoenix eval/experiment.
- **Observability is localhost-only.** `.env.example:33` and README point at `http://localhost:6006`.
  A remote judge reviewing the hosted URL sees no traces, sessions, or eval scores.

### Genuine strengths (credit where due)

- **Tracing foundation is the strongest asset:** clean OpenInference spans (AGENT → TOOL → MCP),
  `register(auto_instrument=True)` + `GoogleGenAIInstrumentor` (`brain.py:28-34`), session grouping via
  `using_session()`, timeline steps mirrored as span events, two traced guardrails (max-loop abort,
  ADK no-final-response fallback).
- **Agent engineering:** dual backends sharing one tool surface, server-side `contextvars` tenant
  isolation (`brain.py:42`), HITL cost-gating.
- **Design/UX (9):** polished React/Zustand SPA, reasoning-trace panel, HITL approval overlay with a
  Yardi CMMS payload preview. Demo-ready.
- **Idea:** lease-liability demarcation (Nike store-fixture vs landlord-panel ambiguity) is a defensible
  wedge above "another ticketing dashboard."

### Bottom line

Arize is the **highest-lift** track choice, but the one where the existing tracing depth gives the best
**story-to-effort ratio**. The work is to _activate_ a designed-but-unbuilt observability layer, not
invent one. Three things make it competitive: (A) run the Arize MCP server, (B) implement the 6 evaluators
for real, (C) make observability reachable by remote judges.

---

## 2. Detailed Execution Plan

### A. Make the Arize MCP server actually run — _threshold requirement_

The official server is **`@arizeai/phoenix-mcp`** (npx-runnable). It connects to a Phoenix instance and
exposes projects, traces, spans, datasets, experiments, prompts, and annotations.

- [ ] Add it as a **third server in `agents/operio_agent/core/mcp_client.py`** alongside mongodb/elasticsearch,
      configured against the hosted Phoenix instance.
- [ ] Expose an agent (or companion "ops-review") tool that calls the Arize MCP server **at runtime** —
      e.g. "fetch eval scores / recent traces for this session" — so the dependency is genuinely invoked,
      not merely declared.
- [ ] **Verify:** a trace shows an MCP call to the Phoenix server during a live run.

### B. Implement the 6 evaluators for real — _what wins the Arize room_

Use **`arize-phoenix-evals`** to replace the keyword heuristics in `session_analysis.py`.

- [ ] `llm_classify` with a **Gemini judge** (via LiteLLM / Vertex adapter) for: Liability correctness,
      Evidence usage, Ambiguity handling, Workflow correctness. Add session-level coherence + resolution.
- [ ] Log results back: `px.Client().log_evaluations(SpanEvaluations(dataframe=..., eval_name=...))` so
      scores render on traces in the Phoenix UI.
- [ ] Convert the 20 scenarios in `agents/tests/evaluate_brain.py` from a mocked pytest gate into a Phoenix
      **dataset + `run_experiment`**, producing a labelled benchmark with an accuracy number to show.
- [ ] **Verify:** eval scores visible on spans + an experiment with a pass-rate the demo can point at.

### C. Make observability reachable by remote judges

- [ ] Deploy **hosted Phoenix** (or Arize AX cloud); point the OTel collector **and** the Arize MCP server
      at it.
- [ ] Update `.env.example:33` and README away from `http://localhost:6006`.
- [ ] **Verify:** opening the submitted URL → traces, sessions, and eval scores are visible without
      cloning the repo.

### Tier-0 universal fixes (required regardless of track)

- [ ] **Deploy a live agent:** containerize FastAPI + MCP subprocesses → Cloud Run (cloud Mongo/Elastic);
      host the `demo/` SPA against it. Fix `deploy-pages.yml` to ship the app, not `docs/`.
- [ ] **Default to ADK + Vertex:** set `reasoning_backend="adk"` and `GOOGLE_GENAI_USE_VERTEXAI=true` in
      `config.py:30`. Prove Gemini → Vertex in a trace screenshot. Use or drop `google-cloud-aiplatform`.
- [ ] Fix the hardcoded mock timestamp in `agents/.../tickets.py:77` (a faked audit timestamp undercuts the
      "traceable decisions" pitch).
- [ ] Re-position README / `docs/HACKATHON.md` to **Arize as primary**; reframe "semantic lease auditing"
      honestly (it is keyword search) so the overclaim does not bite.

### Suggested 3-day sequence

| Day       | Focus                                                                                                 | Outcome                        |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Day 1** | Tier-0 deploy (Cloud Run + hosted Phoenix) + default to ADK/Vertex                                    | Both disqualifiers cleared     |
| **Day 2** | Arize MCP server wired + invoked at runtime (A); implement evals (B)                                  | Track eligibility + real evals |
| **Day 3** | Experiment/benchmark + eval scores on traces (B/C); re-record 3-min demo; rewrite positioning; submit | Submission-ready               |

### Demo narrative (3 minutes)

Tenant chat → live reasoning trace → **eval scores on the trace** → HITL approval gate → open Phoenix to
contrast two traces (ambiguous-liability incident vs non-maintenance policy guidance). The eval scores +
experiment pass-rate are the Arize-specific payoff.

---

## References

- [Phoenix MCP Server](https://arize.com/docs/phoenix/integrations/phoenix-mcp-server)
- [@arizeai/phoenix-mcp (Glama)](https://glama.ai/mcp/servers/@Arize-ai/phoenix)
- [Phoenix LLM Evals](https://arize.com/docs/phoenix/evaluation/llm-evals)
- [arize-phoenix-evals (PyPI)](https://pypi.org/project/arize-phoenix-evals/)
- [Hackathon panel](https://rapid-agent.devpost.com/)
