# Operio Agent

> Autonomous Virtual Dispatcher & SRE for Brick-and-Mortar Retail Center Operations.

Operio Agent is an intelligent orchestration layer built on top of commercial real estate databases, document knowledge bases, and staff communication channels. Powered by Google Cloud Gemini and the Model Context Protocol (MCP), it acts as an autonomous virtual dispatcher and SRE for physical shopping malls.

---

## 📖 Table of Contents

- [Product Vision & Personas](file:///Users/titan/Code/operio-agent/docs/PRODUCT.md)
- [Technical Architecture & Data Schemas](file:///Users/titan/Code/operio-agent/docs/ARCHITECTURE.md)
- [Hackathon Track & Submission Brief](file:///Users/titan/Code/operio-agent/docs/HACKATHON.md)
- [Contributing Guidelines](file:///Users/titan/Code/operio-agent/CONTRIBUTING.md)
- [Privacy Policy](file:///Users/titan/Code/operio-agent/PRIVACY.md)

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
|           Node.js Hono TypeScript Backend                 |
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

### 2. Installation

```bash
pnpm install
```

### 3. Development Commands

- `pnpm run dev` — Starts the Hono backend server in watch mode.
- `pnpm run build` — Compiles TypeScript into `dist/`.
- `pnpm run start` — Runs the compiled backend production build.
- `pnpm run test` — Executes unit tests.
- `pnpm run evaluate` — Triggers the evaluation harness against mock scenarios.
- `pnpm run seed` — Resets and seeds the mock databases.

---

## ⚖️ License

Distributed under the Apache License 2.0. See [LICENSE](file:///Users/titan/Code/operio-agent/LICENSE) for more details.
