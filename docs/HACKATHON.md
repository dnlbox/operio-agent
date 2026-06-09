# Google Cloud Rapid Agent Hackathon

This document compiles the official details, tracks, rules, and requirements for the **Google Cloud Rapid Agent Hackathon**, which is our target competition for the Operio Agent project.

## 📅 Timeline & Status
*   **Start Date:** May 5, 2026
*   **Submission Deadline:** **June 11, 2026, at 2:00 PM PDT** (5:00 PM EDT)
*   **Current Date:** June 8, 2026 (approximately **3 days** remaining)
*   **Location:** Online / Public

---

## 🏆 Prize Structure ($60,000 Total)
The hackathon uses a **"Partner Bucket"** system. Rather than all teams competing for a single prize pool, teams choose a partner track and are judged specifically against others in that track.

Each of the **6 partner tracks** has its own $10,000 prize pool:
*   🥇 **1st Place:** $5,000 in cash
*   🥈 **2nd Place:** $3,000 in cash
*   🥉 **3rd Place:** $2,000 in cash

### The 6 Partner Tracks:
1.  **MongoDB** — Build with the MongoDB MCP server (Database storage, schemas, transactional CRUD).
2.  **Elastic** — Build with the Elastic MCP server (Hybrid vector/keyword search, document parsing).
3.  **Arize** — Build with the Arize MCP server (observability, LLM tracing, evaluators).
4.  **Fivetran** — Build with the Fivetran MCP server (ETL pipelines, database connectors).
5.  **GitLab** — Build with the GitLab MCP server (DevOps, repo management, automated code reviews).
6.  **Dynatrace** — Build with the Dynatrace MCP server (Application monitoring, SRE, logs triaging).

---

## 🛠️ Submission Requirements
To submit a valid entry on Devpost, we must provide:
1.  **Hosted Project URL:** A link to the live, working deployment of our agent application.
2.  **Code Repository URL:** A link to a public, open-source repository containing our code.
    *   *Note:* The repository **must** include a standard, detectable open-source license file (e.g., MIT, Apache 2.0) visible at the top of the repository page (in the About section).
3.  **Demo Video:** A **~3-minute video** demonstrating the agent's functionality, tool execution, and the value it provides.
4.  **Selected Track:** We must specify which partner track we are competing in.
5.  **Submission Form:** Completed submission questions on the Devpost platform.

---

## ⚖️ Judging Criteria
Submissions are evaluated by a panel of Google Cloud and partner engineers based on the following criteria:

*   **Technological Implementation:** Does the interaction with Google Cloud (Gemini / Agent Builder) and the selected Partner's MCP server demonstrate high-quality software development?
*   **Design & User Experience:** Is the UX/UI of the project well-thought-out, intuitive, and clean?
*   **Potential Impact:** How significant of an impact could this agent have on the target industry or communities?
*   **Quality of the Idea:** How creative, unique, and well-executed is the solution?

---

## 👥 Judging Panel Highlights
Our project should speak directly to the backgrounds of the judges, who include:
*   **Google Cloud:** Partner Engineers, Solutions Architects, and ISV specialists (e.g., Merlin Yamssi, Jon Pawlowski). They want to see clean integrations of Gemini and Google Cloud Agent Builder.
*   **Arize:** Head of Solutions Strategy (Clay Miner) and Director of Partner Solutions (Richard Young). They will be highly impressed by robust tracing, guardrails, and accuracy evaluation (which we can trace using Phoenix).
*   **Elastic & MongoDB:** PMs and Developer Relations Directors (e.g., Anish Mathur, Daoud Farooqi). They look for smart, efficient search querying and clean transactional database operations.

---

## 🎯 Recommended Submission Strategy
*   **Primary Track Recommendation:** **Arize**
*   **Why Arize is the strongest wedge:** Operio's implementation features full-lifecycle observability and evaluation, which directly addresses the Arize Solutions rubric. We trace AGENT -> TOOL -> MCP operations, run 6 custom LLM-as-a-judge evaluators for trace verification, deploy `@arizeai/phoenix-mcp` for agent-level telemetry access, and utilize Phoenix experiments to benchmark the reasoning loop.
*   **How to frame MongoDB and Elastic:** Present MongoDB as the transactional storage engine and Elastic as the hybrid retrieval engine that supplies context to the reasoning loop, both of which are traced and evaluated.
*   **Three proof points to emphasize in the demo:**
    1.  The agent retrieves the exact lease/manual evidence and is traced in Phoenix with nested tool/MCP spans.
    2.  Each chat turn is automatically evaluated by 6 custom LLM-as-a-judge classifiers and annotated back to the traces in Phoenix.
    3.  A complete experiment dataset is uploaded to Phoenix, scoring reasoning accuracy across all 20 benchmark scenarios.

## ⏱️ Final 72-Hour Sprint
1.  Polish the live demo path around three incidents: HVAC dispatch, roof leak approval gate, and manual-assisted escalator diagnosis.
2.  Ship a stable hosted deployment and verify Phoenix, Elastic retrieval, and MongoDB-backed ticket transitions on that environment.
3.  Record a tight 3-minute demo that shows tenant chat, trace, approval, and final dispatch without dead time, highlighting the live evaluation annotations in Phoenix.
4.  Make the GitHub repo self-explanatory: current architecture, working setup commands, open-source license, screenshots, and track choice.
5.  Submit with a crisp one-sentence positioning line: "Operio is an autonomous mall operations agent that turns leases, manuals, and staff state into traceable and evaluated dispatch decisions."
