# Privacy Policy for Operio Agent

Last updated: May 30, 2026

At **Operio Agent** ("we", "our", or "us"), we prioritize the privacy and security of your operational data. This Privacy Policy details how data is managed within the open-source Operio Autonomous Mall Operations Agent application.

---

## 1. Data Collection and Processing

Operio Agent is designed to run as an autonomous orchestration layer connecting your local environments to Model Context Protocol (MCP) servers and external services.

*   **Transactional Operational Data:** All tenant data, technician registries, and work orders queried from MongoDB or PostgreSQL are processed within your self-hosted instance.
*   **Vector search / Leases RAG:** The document searches (e.g. lease agreements, troubleshooting manuals) run against your self-hosted Elasticsearch index.
*   **LLM Inference:** Queries containing tenant requests, snippets of lease agreements, and technician credentials are sent to Google Cloud Gemini / Agent Builder API endpoints. Please refer to Google Cloud's data privacy policies regarding the processing of data via Vertex AI / Gemini API.
*   **Tracing and Observability:** Agent traces and tool execution metadata are pushed to Arize Phoenix endpoints for continuous quality auditing and evaluation.

---

## 2. Third-Party Services

By deploying and configuring this application, you may connect to the following third-party integrations:
*   **Google Cloud Vertex AI / Gemini API** (for LLM orchestration)
*   **Arize Phoenix** (for trace auditing)
*   **Elasticsearch** (hosted/local search instances)
*   **MongoDB** (hosted/local database instances)

Please review the privacy policies of these providers to understand their data collection practices.

---

## 3. Security

Since Operio Agent is open-source and self-hosted, you are responsible for securing the environment variables (e.g., API keys, database credentials) and enforcing appropriate transport security (HTTPS/WSS) on your hosted instances.

---

## 4. Contact

For security-related issues, please open an issue in the public repository at [github.com/dnlbox/operio-agent](https://github.com/dnlbox/operio-agent) or contact `dnl.vzlt@gmail.com`.
