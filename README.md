# Operio Agent

> Autonomous Virtual Dispatcher & SRE for Brick-and-Mortar Retail Center Operations.

Operio Agent is an intelligent orchestration layer built on top of commercial real estate databases, document knowledge bases, and staff communication channels. Powered by Google Cloud Gemini and the Model Context Protocol (MCP), it acts as an autonomous virtual dispatcher and SRE for physical shopping malls.

---

## 📖 Table of Contents

- [Product Vision & Personas](docs/PRODUCT.md)
- [Technical Architecture & Data Schemas](docs/ARCHITECTURE.md)
- [Arize Phoenix Evaluation Plan](docs/ARIZE_EVALS.md)
- [Hackathon Track & Submission Brief](docs/HACKATHON.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Privacy Policy](PRIVACY.md)

---

## 🛠️ System Architecture

Operio Agent coordinates tenant requests, audits leases, and dispatches technicians using a structured Model Context Protocol (MCP) approach:

```md
+-----------------------------------------------------------+
|                      USER INTERFACE                       |
|   Tenant Chat Portal   |   Operations Manager Dashboard   |
+-----------------------------+-----------------------------+
                              |
                              v REST / WebSockets
+-----------------------------------------------------------+
|                    AGENT ORCHESTRATOR                     |
|           FastAPI Python Orchestrator                     |
|  Reasoning Loop: Plan -> Tool Calls -> Execute -> Respond |
+-----------------------------+-----------------------------+
                              |
                              v Model Context Protocol (MCP)
+-----------------------------------------------------------+
|                EXTERNAL INTEGRATIONS (MCP)                |
|    - Elastic (Lease RAG)                                  |
|    - MongoDB (CRUD operational tickets)                   |
|    - Arize Phoenix (Trace logging and evaluations)        |
+-----------------------------------------------------------+
```

### Key Integrations

1. **Elastic MCP (Search & RAG):** Vector and keyword querying of lease agreements to audit liabilities.
2. **MongoDB MCP (Transactional State):** Querying staff status, updating work orders, and managing tenants.
3. **Arize Phoenix (Observability):** Trace capturing and continuous evaluating of LLM accuracy.

---

## ⚡ Quick Start

### 1. Prerequisites

- Node.js v22+
- pnpm v9+
- Python 3.13+
- `uv`

### 2. Installation

```bash
pnpm install
```

### 3. Development Commands

- `pnpm run dev` — Starts the FastAPI orchestrator on `http://localhost:3001`.
- `pnpm --filter operio-frontend dev` — Starts the Vite SPA locally.
- `pnpm run frontend:build` — Builds the frontend into `demo/`.
- `pnpm run frontend:review` — Runs local static review checks for aliases, JSDoc, and loop discipline.
- `pnpm run test` — Runs frontend tests plus backend pytest suites.
- `pnpm run evaluate` — Triggers the evaluation harness against mock scenarios.
- `pnpm run seed` — Resets and seeds the mock databases.

---

## ⚖️ License

Distributed under the Apache License 2.0. See [LICENSE](LICENSE) for more details.
