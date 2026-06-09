# Operio Agent — Arize Track: Jury Assessment & Execution Plan

> Google Cloud Rapid Agent Hackathon · Submission deadline **June 11, 2026, 2:00 PM PDT**.
> Selected track: **Arize** (observability, LLM tracing, evaluators).

---

## 0. Implementation Status — updated June 8 (post-build)

**The Arize track is now eligible and competitive.** All three deciding Arize items (A, B, C) are
implemented and verified in code; the only remaining hard blocker is the live hosted deployment.

| Plan item | Status | Evidence |
| --- | --- | --- |
| **A. Arize MCP server invoked at runtime** | ✅ Done | 3rd MCP server started + pointed at Arize AX (`mcp_client.py:99-110`, `:59-68`); exposed as `query_telemetry` agent tool in `self.tools` (`brain.py:117`) calling `call_tool("phoenix", "list_projects")` (`brain.py:678-680`). |
| **B. 6 LLM-as-judge evaluators** | ✅ Done | `create_classifier` with Gemini/Vertex judge for all six (`evals.py:36-159`); logged back via `SpanEvaluations`/`log_evaluations` (`evals.py:202-234`); fired live per turn from `chat.py:146`. |
| **B. Benchmark experiment** | ✅ Done | `run_experiment` over 20 scenarios, asserts `accuracy >= 80.0` (`evaluate_brain.py:411,659-686`) — **passing >80% per latest run.** |
| **C. Remote-reachable observability** | ✅ Done | OTLP export to `https://otlp.arize.com/v1/traces` with space-id/api-key headers (`brain.py:23-50`); local Phoenix as fallback. |
| **Tier-0: ADK + Vertex default** | ✅ Done | `reasoning_backend="adk"`, `google_genai_use_vertexai=True` defaults (`config.py:34-39`); `google-cloud-aiplatform` + `arize-phoenix-evals` in `pyproject.toml`. |
| **Tier-0: mock timestamp fix** | ✅ Done | `datetime.now(timezone.utc)` (`tickets.py:78,157`). |
| **Tier-0: HACKATHON.md repositioned to Arize** | ✅ Done | Commit `Update HACKATHON.md with revised submission strategy`. |
| **Tier-0: live hosted agent** | 🔴 **Open — last blocker** | No Dockerfile/Cloud Run/cloudbuild; `deploy-pages.yml:34` still ships static `./docs`. A judge cannot run the agent from the submission URL. |
| **README primary-track + search honesty** | ⚠️ Partial | `README.md` still names Elastic as primary and calls keyword search "semantic"; align to Arize. |
| Demo video (<3 min) + Devpost form | ❓ Outstanding | Confirm recorded, public, and submitted. |

### What's left (priority order, ~remaining time)

1. 🔴 **Deploy the live agent (only disqualifier left).** Containerize the FastAPI backend + MCP
   subprocesses → **Cloud Run**; provision cloud MongoDB + Elasticsearch (or Elastic Cloud) and seed them;
   host the `demo/` SPA against the live API. Point the Devpost "hosted URL" there. Stop publishing
   `./docs` as the product (repurpose Pages for the SPA or drop it). **Verify in incognito: chat works
   end-to-end and a trace + eval scores appear in Arize AX.**
2. ⚠️ **README cleanup.** Switch the stated primary track to **Arize**; describe Elastic as keyword/BM25
   retrieval (not "semantic") so the claim can't be challenged; add an Arize AX trace+eval screenshot.
3. ❓ **Record the 3-minute demo** (script in §3) and complete the Devpost form: public repo + Apache-2.0
   license visible in About, hosted URL, video link, Arize track selected, team listed.

> The build executed sections A/B/C and most of Tier-0. The sections below are retained as the original
> reference plan; checkboxes reflect current state.

---

## 1. Jury Panel Assessment

> _Snapshot from the pre-build audit (June 8). Scores reflect the state **before** the Arize MCP server,
> live evaluators, and AX export were implemented — see §0 for current status. Re-scoring after a live
> deployment lands: Technological Implementation and the Arize verdict should move up materially._

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

- [x] Added as a **third server in `agents/operio_agent/core/mcp_client.py`** (`:37,99-110`), pointed at
      Arize AX (`PHOENIX_BASE_URL = https://app.phoenix.arize.com/s/{space_id}`, `:59-68`).
- [x] Exposed as the `query_telemetry` agent tool, registered in `self.tools` (`brain.py:117`), invoking
      `call_tool("phoenix", "list_projects")` at runtime (`brain.py:678-680`).
- [x] **Verified:** the Phoenix MCP call is wrapped in an OTel CLIENT span (`mcp_client.py:137-143`), so a
      live run shows the MCP invocation in the trace.

### B. Implement the 6 evaluators for real — _what wins the Arize room_

Use **`arize-phoenix-evals`** to replace the keyword heuristics in `session_analysis.py`.

- [x] All six implemented with `create_classifier` + a **Gemini judge** (Vertex when enabled,
      `evals.py:12-159`): Liability, Evidence, Ambiguity, Workflow, Session coherence, Resolution.
- [x] Logged back via `Client().log_evaluations(SpanEvaluations(...))` (`evals.py:202-234`); fired live
      per chat turn in fire-and-forget mode (`chat.py:146`, `evals.py:162-240`).
- [x] `run_experiment` over the 20 scenarios with an accuracy gate `assert accuracy >= 80.0`
      (`evaluate_brain.py:411,659-686`) — **currently passing >80%.**
- [x] **Verified:** eval scores log to spans and the experiment reports a pass-rate for the demo.

### C. Make observability reachable by remote judges

- [x] Wired to **Arize AX cloud**: traces export to `https://otlp.arize.com/v1/traces` with
      space-id/api-key headers (`brain.py:23-50`); the Phoenix MCP server uses the AX base URL
      (`mcp_client.py:59-68`). Local Phoenix remains the fallback when AX creds are absent.
- [x] `.env.example` adds `ARIZE_API_KEY` / `ARIZE_SPACE_ID` and the `PHOENIX_MCP_COMMAND` (`:35-42`).
- [ ] **Verify after deploy:** opening the *hosted* URL → traces, sessions, and eval scores appear in
      Arize AX without cloning. (Blocked on the deployment item below.)

### Tier-0 universal fixes (required regardless of track)

- [ ] 🔴 **Deploy a live agent (LAST BLOCKER):** containerize FastAPI + MCP subprocesses → Cloud Run
      (cloud Mongo/Elastic); host the `demo/` SPA against it. `deploy-pages.yml:34` still ships `docs/` —
      repoint it at the app or retire it. No Dockerfile/Cloud Run config exists yet.
- [x] **Default to ADK + Vertex:** `reasoning_backend="adk"` and `google_genai_use_vertexai=True`
      (`config.py:34-39`); `google-cloud-aiplatform` + `arize-phoenix-evals` declared in `pyproject.toml`.
      _(Still add the Gemini→Vertex trace screenshot to the README.)_
- [x] Fixed the hardcoded mock timestamp → `datetime.now(timezone.utc)` (`tickets.py:78,157`).
- [ ] ⚠️ **README still names Elastic as primary** and calls keyword search "semantic." `docs/HACKATHON.md`
      is repositioned to Arize; bring `README.md` in line and describe Elastic retrieval as BM25/keyword.

### Remaining sequence (A/B/C + most of Tier-0 already done)

| Step | Focus | Outcome |
| --- | --- | --- |
| **1 (now)** | Containerize + deploy backend to Cloud Run; provision/seed cloud Mongo + Elastic; host SPA against live API | Clears the last disqualifier |
| **2** | Smoke-test the hosted URL in incognito; confirm a trace + eval scores land in Arize AX from the live env | Judge-reachable proof |
| **3** | README → Arize primary + honest search wording + AX screenshot; record 3-min demo (§3); complete Devpost form | Submission-ready |

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
