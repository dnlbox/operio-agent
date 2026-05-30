# Technical Architecture

This document describes the technical stack, system components, database schemas, and integration points for the **Operio Autonomous Mall Operations Agent**.

---

## 1. Technology Stack

*   **LLM & Reasoning Engine:** Gemini (integrated via Google Cloud Agent Builder or direct SDK).
*   **Database (State & Metadata):** **MongoDB** (to store Tenants, Tech/Staff, Work Orders, Assets).
*   **Vector Search & Knowledge Base:** **Elastic** (to index lease PDFs, blueprints, equipment manuals).
*   **Observability & Tracing:** **Arize / Phoenix** (for agent trace monitoring, guardrail auditing, and evaluation metrics).
*   **Frontend Interface:** Single-page dashboard built using HTML5, Vanilla CSS, and modern Javascript.
*   **Backend Services:** Node.js / Express API coordinate the agent reasoning loop and expose endpoints to the frontend.

---

## 2. System Architecture Overview

The system consists of three main boundaries: the User Interface, the Orchestrator, and the External Integration Layer (exposed via MCP servers).

```
+-----------------------------------------------------------+
|                      USER INTERFACE                       |
|   Tenant Chat Portal   |   Operations Manager Dashboard   |
+-----------------------------+-----------------------------+
                              |
                              v REST / WebSockets
+-----------------------------------------------------------+
|                    AGENT ORCHESTRATOR                     |
|           Node.js Express / Python Backend                |
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

---

## 3. Data Schemas (MongoDB)

To facilitate operational dispatching, the agent interacts with three key databases collections.

### A. Tenants (`tenants`)
```json
{
  "_id": "tenant_001",
  "storeName": "Nike Store",
  "unitNumber": "Unit 104",
  "sector": "Sector B",
  "managerName": "Marcus Vance",
  "contactEmail": "marcus.vance@nike-mall.com",
  "leaseId": "lease_nike_104"
}
```

### B. Technicians / Staff (`staff`)
```json
{
  "_id": "staff_001",
  "name": "Sarah Connor",
  "skills": ["HVAC", "Electrical"],
  "status": "Available", 
  "currentLocation": "Sector B",
  "shiftStart": "08:00",
  "shiftEnd": "17:00",
  "ratePerHour": 45.00
}
```

### C. Work Orders (`work_orders`)
```json
{
  "_id": "wo_9942",
  "tenantId": "tenant_001",
  "assetId": "asset_hvac_104",
  "description": "Storefront AC unit blowing warm air.",
  "status": "Pending Dispatch", 
  "assignedTo": null,
  "costEstimation": 150.00,
  "leaseResponsibility": "Tenant (up to $1,000)",
  "leaseClauseRef": "Section 9.1 - Tenant AHU Maintenance",
  "timeline": [
    { "status": "Created", "timestamp": "2026-05-28T14:00:00Z" }
  ]
}
```

---

## 4. MCP Integration Strategy

The agent uses three separate Model Context Protocol (MCP) servers to perform its duties:

### A. Elastic MCP Server (Information Retrieval)
*   **Purpose:** Vector & Keyword Search.
*   **Tools exposed to Agent:**
    *   `search_leases(query)`: Searches tenant lease documents for responsibility clauses.
    *   `search_manuals(equipment_model, query)`: Finds diagnostic and troubleshooting steps for specific assets.

### B. MongoDB MCP Server (State Control)
*   **Purpose:** Transactional Operations.
*   **Tools exposed to Agent:**
    *   `query_active_staff(skill, sector)`: Finds available on-site operators.
    *   `create_work_order(wo_payload)`: Inserts a new work order.
    *   `update_work_order_status(wo_id, status, technician_id)`: Updates database state.

### C. Arize MCP / Phoenix (Auditing & Evaluations)
*   **Purpose:** Trace Logging and Guardrails.
*   **Mechanic:** Every execution steps are traced. Evaluators check:
    *   Is the retrieved lease snippet *relevant* to the tenant request?
    *   Did the tool call generate a schema-valid JSON object?

---

## 5. Human-in-the-Loop (HITL) Flow

To prevent unauthorized costs or critical failures, the Agent Orchestrator implements an escalation system based on pre-defined criteria:

```
[Agent evaluates ticket]
          |
          v
Is estimated cost > $150 OR lease responsibility ambiguous?
         / \
        /   \
  YES  /     \  NO
      /       \
     v         v
[Draft Work Order]                 [Auto-Execute Work Order]
[Set Status: 'Pending Approval']   [Set Status: 'Dispatched']
[Send alert to Manager Dashboard]  [Notify Tenant and Tech]
```

1.  **Approval Request:** The manager is shown the drafted work order, the relevant lease clause, and the recommended contractor.
2.  **Interaction:** The manager clicks **Approve** or **Reject / Modify**.
3.  **Resumption:** If approved, the agent updates the status to `Dispatched` and notifies the contractor.
