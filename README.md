# Operio Agent

> Autonomous mall operations agent for lease-aware maintenance dispatch.

Operio Agent is a FastAPI + React application for handling retail center incidents end to end. It combines Gemini-powered reasoning, a multi-tiered MongoDB Atlas Search & Vector Search pipeline for lease and manual retrieval, MongoDB-backed operational state, and Arize Phoenix tracing so each dispatch decision is evidence-backed and reviewable.

## What It Does

- Accepts tenant incident reports through a chat-driven workflow.
- Retrieves lease clauses and equipment manual evidence before acting.
- Checks available technicians and creates or updates work orders through MCP tools.
- Escalates landlord-liable or high-cost incidents into a human-in-the-loop approval path.
- Logs model calls and tool execution traces to Arize Phoenix.

## Runtime Stack

- Google Cloud Agent Builder via `google-adk`
- Gemini on Vertex AI and direct Google Developer API
- MongoDB MCP server for work orders, sessions, tenants, staff, leases, and manuals (RAG Search)
- Arize Phoenix for trace capture and evaluation visibility
- FastAPI backend served with a React + Vite frontend

## Partner Track

Primary submission target: `Arize`

Why this track fits:
- **Trace-Level Observability**: Full execution traces (AGENT -> TOOL -> MCP) are streamed directly to Arize Phoenix.
- **LLM-as-a-Judge Evaluators**: Incorporates 6 custom evaluators (Liability correctness, Evidence usage, Ambiguity handling, Workflow correctness, Session coherence, Resolution quality) that analyze each chat turn and log scores directly to Phoenix traces.
- **Phoenix MCP Server Integration**: Instantiates and communicates with `@arizeai/phoenix-mcp` at runtime, exposing telemetry, datasets, and experiments directly to the agent.
- **Continuous Benchmarking**: The scenario benchmark can be run locally or published into Arize AX as a reusable dataset + experiment baseline.

## Repository Guide

- [Product Vision & Personas](docs/PRODUCT.md)
- [Technical Architecture & Data Schemas](docs/ARCHITECTURE.md)
- [Hackathon Track & Submission Brief](docs/HACKATHON.md)
- [Arize Phoenix Evaluation Plan](docs/ARIZE_EVALS.md)
- [Arize AX Baseline Flow](docs/ARIZE_AX_MIGRATION.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Privacy Policy](PRIVACY.md)

## Local Setup

### Prerequisites

- Node.js 22+
- `pnpm` 9+
- Python 3.11+
- `uv`
- Docker Desktop or another Docker runtime

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Set at least:

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPERIO_REASONING_BACKEND` | Selects the agent runtime (`adk` or `legacy`) | `legacy` |
| `GOOGLE_GENAI_USE_VERTEXAI` | Routes Gemini calls through Vertex AI | `false` |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project for Vertex AI / deployment | none |
| `GOOGLE_CLOUD_LOCATION` | Google Cloud region for Vertex AI | `us-central1` |
| `GEMINI_API_KEY` | Optional legacy fallback for direct Gemini API use | none |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGO_DB` | MongoDB database name | `operio` |
| `PHOENIX_PROJECT_NAME` | Phoenix project name | `operio-agent` |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix collector base URL | `http://localhost:6006` |

For Google Cloud-backed runs, authenticate locally before starting the app:

```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Start local infrastructure

```bash
docker compose up -d
```

This starts:

- MongoDB on `http://localhost:27017`
- Arize Phoenix on `http://localhost:6006`

### 4. Seed demo data

```bash
pnpm run seed
```

This loads mock tenants, technicians, work orders, lease documents, and equipment manuals, automatically generating 3072-dimensional vector embeddings using Gemini (`gemini-embedding-2`) to enable semantic search.

### 5. Run the app

```bash
pnpm run dev
```

Open:

- App: [http://localhost:3001](http://localhost:3001)
- Phoenix traces: [http://localhost:6006](http://localhost:6006)

### 6. Run the scenario evaluation flow

The repo now has a single orchestration command for the scenario baseline:

```bash
pnpm run eval:flow
```

Useful variants:

```bash
pnpm run eval:flow -- --no-seed --limit 1
pnpm run eval:flow -- --publish --space operio
pnpm run eval:flow -- --publish --space operio --scenario-ids 1,9,10
```

What it does:

- optionally reseeds MongoDB
- runs the local scenario benchmark
- exports the AX dataset artifact
- optionally publishes the dataset and experiment baseline to Arize AX

Generated artifacts land under `agents/demo/`:

- `operio_ax_baseline_results.json`
- `operio_ax_eval_dataset.csv`
- `operio_ax_experiment_runs.json`
- `operio_ax_run_annotations.json`

### 7. Optional frontend-only dev server

```bash
pnpm run frontend:dev
```

Use this when iterating on the SPA with Vite hot reload. The frontend proxies API traffic to the FastAPI backend on port `3001`.

## Demo Flow

Good scenarios for a judge or reviewer:

1. HVAC failure with lease-backed tenant liability and auto-dispatch.
2. High-cost landlord-liable repair that pauses for manager approval.
3. Equipment diagnosis that pulls troubleshooting context from manual search.

## Development Commands

- `pnpm run dev` - start the FastAPI backend on `http://localhost:3001`
- `pnpm run build` - type-check the TypeScript workspace and build the frontend
- `pnpm run frontend:build` - build the frontend bundle into `demo/`
- `pnpm run frontend:review` - run alias, JSDoc, and loop-discipline checks
- `pnpm run frontend:test` - run frontend tests
- `pnpm run test` - run MCP tests, frontend tests, and backend pytest suites
- `pnpm run evaluate` - run the scenario benchmark pytest gate
- `pnpm run eval:flow` - run the local scenario baseline and optionally publish it to Arize AX
- `pnpm run seed` - reseed MongoDB with demo data and generate search embeddings

## License

Distributed under the Apache License 2.0. See [LICENSE](LICENSE).
