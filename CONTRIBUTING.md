# Contributing to Operio Agent

Welcome! We are excited that you want to contribute to the **Operio Autonomous Mall Operations Agent**. This guide outlines how to get started, set up your development environment, and make a pull request.

---

## 🛠️ Getting Started

### 1. Requirements
*   **Node.js** v22+
*   **pnpm** v9+ (or corepack enabled)
*   **MongoDB** & **Elasticsearch** (either locally or through active Model Context Protocol servers)

### 2. Environment Setup
1.  Clone the repository:
    ```bash
    git clone git@github.com:dnlbox/operio-agent.git
    cd operio-agent
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Set up local configurations (e.g. environment files `.env` or configurations in `.agents/`).

---

## 📋 Code Quality & Styling

To keep the codebase healthy and clean, please adhere to these rules:

1.  **TypeScript & Hono:**
    *   Write clean, type-safe route controllers.
    *   Utilize `@/*` relative path aliases for local imports (e.g., `import { db } from '@/backend/db'`).
2.  **JSDoc & TSDoc Guidelines:**
    *   Follow Google's JSDoc styling guidelines.
    *   Ensure all public functions, classes, interfaces, and variables have descriptive JSDoc block comments.
    *   Avoid redundant type declarations in JSDoc signatures inside TypeScript files.
3.  **Frontend styling:**
    *   Use modern HTML5 and Vanilla CSS variables matching our design system "The Precision Authority".
    *   Avoid monolithic CSS frameworks unless explicitly configured.

---

## 🚀 Pull Request Workflow

1.  Create a branch from `main`:
    ```bash
    git checkout -b feature/your-feature-name
    ```
2.  Commit your changes with clear, descriptive commit messages.
3.  Verify that your changes compile and pass tests:
    ```bash
    pnpm run build
    pnpm run test
    ```
4.  Push your branch to GitHub and open a Pull Request (PR) against `main`.

---

## ⚖️ License
By contributing, you agree that your contributions will be licensed under the project's **Apache License 2.0**.
