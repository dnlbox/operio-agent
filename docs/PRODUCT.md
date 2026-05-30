# Operio: Autonomous Mall Operations Agent

This document defines the product vision, market problem, and target solution for **Operio Agent**, an autonomous agent designed to streamline facilities management, lease compliance, and maintenance operations in physical shopping malls and retail centers.

---

## 1. Problem Space

Physical shopping malls and commercial real estate assets are managed using fragmented, manual, and disconnected systems. Today, property developers and operators (such as RioCan) face three key challenges:

### A. The "Human Glue" in Lease Audits
Every tenant in a shopping mall has a custom, negotiated lease agreement. When a maintenance issue arises (e.g., HVAC failure, plumbing leak, storefront window crack), operators must manually audit the specific PDF lease agreement to determine **who is financially and operationally responsible**. 
*   *Example:* Does Section 9.2 place storefront HVAC repair costs on the landlord or the tenant?
This manual search creates operational delays and leads to disputes or incorrect billings.

### B. Manual Vendor Coordination and Dispatch
Once responsibility is established, dispatchers must log into CMMS systems (like Yardi, ServiceChannel, or Corrigo) to search for approved contractors, verify certificates of insurance (COI), check rates, and draft work orders. This is a highly manual, multi-step process prone to human delays.

### C. Isolated Asset Diagnostics
Building operators and technicians in the field encounter equipment faults (e.g., an escalator flashing an error code). Finding troubleshooting protocols requires digging through physical binders or unindexed cloud directories containing thousands of pages of PDF equipment manuals.

---

## 2. The Solution: Operio Agent

**Operio Agent** is an intelligent orchestration layer that sits on top of commercial real estate databases, document knowledge bases, and team communication channels. Powered by Gemini and the Model Context Protocol (MCP), it acts as an autonomous virtual dispatcher and SRE for brick-and-mortar operations.

```
+------------------------------------------------------------+
|                       TENANT PORTAL                        |
|   "Our AC is blowing warm air. Please send a technician."  |
+------------------------------------+-----------------------+
                                     |
                                     v
+------------------------------------------------------------+
|                       OPERIO AGENT                         |
|   1. Audit Lease (via Elastic RAG)                         |
|   2. Check On-Site Technicians & Skills (via MongoDB)       |
|   3. Create and Dispatch Work Order (via MongoDB)          |
|   4. Human-in-the-Loop Safeguard (for expensive repairs)   |
+------------------------------------+-----------------------+
                                     |
                                     v
+------------------------------------------------------------+
|                     BUILDING OPERATIONS                     |
|   Sarah (HVAC Technician) receives work order & directions |
+------------------------------------------------------------+
```

### Key Capabilities:
1.  **Semantic Lease Auditing:** Instantly parses tenant leases to extract liability clauses, limits of liability, and maintenance boundaries, presenting them clearly to both the tenant and manager.
2.  **Autonomous Dispatching:** Connects to the vendor and staff registries to match work orders with the nearest qualified, active, and compliant technician.
3.  **Interactive Diagnostics Assistant:** Leverages manufacturer manuals to answer field questions, troubleshoot error codes, and record maintenance actions back into the asset ledger.
4.  **Human-in-the-Loop (HITL) Guardrails:** Escalates high-cost repairs, lease exceptions, or ambiguous situations to human property managers for authorization before modifying external systems.

---

## 3. Core Persona Flows

### A. The Tenant (e.g., Retail Store Manager)
*   **Need:** Report facility issues quickly and get transparent updates on who pays and when help is coming.
*   **Flow:** Sends a message to the tenant chat interface -> Receives an immediate analysis of lease responsibility -> Confirms dispatch -> Receives technician details and ETA.

### B. The Property/Mall Manager
*   **Need:** Maintain high operational uptime, enforce lease compliance, and manage repair budgets.
*   **Flow:** Monitors the live operations dashboard -> Receives push approvals for high-cost dispatch requests -> Audits agent reasoning traces -> Views performance metrics and lease patterns.

### C. The Building Technician / Contractor
*   **Need:** Clear work orders, equipment contexts, and step-by-step troubleshooting assistance.
*   **Flow:** Receives automated work order assignment on mobile -> Reports equipment status/error code to agent -> Receives step-by-step manual troubleshooting guide -> Updates work order status to complete.
