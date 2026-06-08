# Developer Agent Instructions

Welcome to the **Operio Autonomous Mall Operations Agent** codebase. This document unifies all development guidelines, styling foundations, functional programming paradigms, and testing/verification rules for AI agents and human developers modifying this repository.

---

## 1. Directory Structure

Ensure any new or refactored files align with the following structure:
*   `docs/` — Product vision, system architecture, database schemas, and brief documents.
*   `agents/` — FastAPI Python backend orchestrating the Gemini reasoning loop.
*   `mcp_servers/` — External integration stdio subprocesses written in TypeScript (MongoDB, Elastic).
*   `frontend/` — Single-page dashboard (Vite + Vanilla TypeScript SPA).
    *   `frontend/public/` — Static assets (leases/manuals PDFs).
    *   `frontend/src/` — SPA source code.
        *   `frontend/src/styles/` — Core design system and layout.
        *   `frontend/src/types/` — Strict TypeScript definitions.
        *   `frontend/src/state/` — Functional immutable state store.
        *   `frontend/src/api/` — Pure fetch requests.
        *   `frontend/src/utils/` — Functional helpers (DOM, FP, Markdown).
        *   `frontend/src/components/` — UI modules (Sidebar, Dashboard, TenantHub, KnowledgeBase, CitationDrawer, HitlOverlay).
*   `demo/` — Target build directory where Vite compiles the SPA (served statically by FastAPI).
*   `tests/` — Mock dataset generators, test suites, and evaluation runs.

---

## 2. Coding Guidelines & Best Practices

### A. TypeScript & Absolute Paths
- **Path Aliases:** Use path mappings (`@/*` pointing to `src/*` inside `frontend/`) for all local imports to avoid deep relative paths (e.g., `import { store } from '@/state/store'`).
- **Strict Configuration:** Ensure strict type checking is enabled in the compiler configurations.

### B. TS/JSDoc Guidelines
Follow Google's styling guidelines:
- **Do not repeat types in JSDoc** inside TypeScript files. Let TypeScript enforce the parameter and return types natively.
- Use JSDoc comments to describe **semantic behavior, constraints, and side effects** for all public interfaces, methods, classes, and helper functions.

### C. TypeScript Functional Programming (FP) Paradigms
Functional Programming paradigms apply to **all TypeScript/JavaScript code** in the workspace (including the frontend, MCP servers, and any TS backend code):
- **Pure Functions:** Functions that process data, format strings, parse markdown, or filter lists must be pure (given the same inputs, they return the same output without side effects).
- **Immutability:** Never mutate states directly. Implement immutable updates using structural copying (e.g., `{ ...state, value }`) inside state reducers.
- **Declarative Array Methods:** Favor `map`, `filter`, and `reduce` over traditional `for` loops.
- **Separation of Side Effects:** Keep I/O interactions (API fetches, local storage writes, and direct DOM mutations) separated from pure transformation logic.

### D. Python Coding Guidelines (FastAPI & Pyright)
Python code (such as in `agents/` and tests) should follow standard FastAPI, Pythonic, and strict type-safety conventions:
- **FastAPI Idioms:** Prefer Dependency Injection (`Depends`) for sharing database sessions, configurations, and clients. Use Pydantic schemas explicitly for all request and response payloads.
- **Strict Typing (Pyright):** Annotate all variables, function arguments, and return values. Ensure Pyright (or equivalent type-checker) resolves type safety cleanly without type errors.
- **Pythonic Standards (PEP 8):** Adhere to standard style formatting (black/flake8 conventions) and document classes and functions with clear docstrings describing parameters and returns.
- **Paradigm Flexibility:** Python code is not strictly restricted to functional constructs; utilize standard object-oriented programming (OOP) for models/services and procedural routing patterns.

---

## 3. Visual & Styling System (Nordic Slate Deep)

We use custom CSS with these modern foundations:
- **Color Palette:** Saturated obsidian backgrounds (`#080a0f`, `#111319`), architecture slate borders, and primary electric sky blue highlights (`#38bdf8`).
- **Glassmorphism:** Use translucent card layouts with `backdrop-filter: blur(16px)` and thin light-leak borders (`rgba(255, 255, 255, 0.05)`).
- **Typography:** Modern typography using Google Fonts (Manrope for headings, Inter for body, JetBrains Mono for codes/logs).
- **Micro-animations:** Subtle hover transformations (`translateY(-2px)`), glow transitions, and fading animations (`fadeIn` on hash changes).
- **Responsiveness:** Maintain a flexible layout using CSS Flexbox and Grid.

---

## 4. Incremental Verification & Code Review Guidelines

To optimize execution speed and resource usage, developers and agents should select the appropriate verification level based on the scope of changes:

### A. Verification Tiers
1.  **Tier 1: Visual/Style/Documentation Changes** (e.g., CSS layout adjustments, HTML markup edits, documentation updates, comment changes)
    *   **Action:** Run compilation check (`pnpm --filter operio-frontend build`) and run static review (`pnpm run frontend:review`).
    *   **Skip:** Unit tests, backend Python pytest suites, evaluation runs, and autonomous peer review agents.
2.  **Tier 2: Frontend Logic Changes** (e.g., state store updates, component logic, FP utility modifications)
    *   **Action:** Build the frontend, run static review, and execute target frontend tests (`pnpm --filter operio-frontend test`).
    *   **Skip:** Python backend pytest suites, evaluation runs, and autonomous peer review agents.
3.  **Tier 3: Backend & Core Orchestration Changes** (e.g., main reasoning loop, FastAPI endpoints, prompt templates)
    *   **Action:** Run backend tests (`PYTHONPATH=. uv run --project agents pytest`) and check status.
    *   **Skip:** Frontend builds/tests (unless logic is shared) and evaluation runs.
4.  **Tier 4: Major Architectural Refactors or Release Prep**
    *   **Action:** Run full verification suite (`pnpm run test`), full evaluation harness (`pnpm run evaluate`), and invoke the **Autonomous Peer Review Agent** for deep static compliance auditing.

### B. Audit & Review Rules
-   **Static Auditing:** Always run `pnpm run frontend:review` locally before completing a task to catch import alias and JSDoc violations immediately.
-   **Autonomous Peer Review Agent:** Only trigger the autonomous `code_reviewer` subagent for Tier 4 tasks to avoid redundant overhead on simple visual or local logic tasks.

---

## 5. Development Commands

- `pnpm install` — Installs dependencies.
- `pnpm run dev` — Starts the Python FastAPI orchestrator backend (serving `demo/` statically).
- `pnpm --filter operio-frontend dev` — Launches the local Vite development server.
- `pnpm --filter operio-frontend build` — Compiles the typescript frontend and outputs bundle to `demo/`.
- `pnpm run test` — Runs the vitest and python pytest suites.
- `pnpm run evaluate` — Triggers evaluation harness against mock datasets.
- `pnpm run frontend:review` — Runs local static code review checks for import paths, JSDocs, and functional loops.
