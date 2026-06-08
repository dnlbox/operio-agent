"""Operio Agent reasoning loop and tool execution engine."""

import contextvars
import json
import sys
from contextlib import nullcontext
from typing import Any, Dict, List
from google import genai
from google.genai import types
from opentelemetry import trace
from openinference.instrumentation.google_genai import GoogleGenAIInstrumentor
from phoenix.otel import SpanAttributes, register, using_session

from operio_agent.config import settings
from operio_agent.core.mcp_client import McpClientManager
from operio_agent.core.prompts import SYSTEM_INSTRUCTION_TEMPLATE

# 1. Initialize Phoenix Tracing Provider
print(
    f"[Brain] Registering OpenTelemetry tracer with Phoenix project "
    f"'{settings.phoenix_project_name}' at {settings.phoenix_collector_endpoint}..."
)
try:
    tracer_provider = register(
        project_name=settings.phoenix_project_name,
        endpoint=f"{settings.phoenix_collector_endpoint}/v1/traces",
        auto_instrument=True,
    )
    # Instrument the official google-genai SDK
    GoogleGenAIInstrumentor().instrument(tracer_provider=tracer_provider)
    print("[Brain] Phoenix tracing instrumentation completed successfully.")
except Exception as e:
    print(
        f"[Brain] Phoenix tracing registration failed (continuing without tracing): {e}"
    )

# 2. Context Variables for Secure Session Context Injection
active_tenant_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "active_tenant_id", default=None
)
active_lease_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "active_lease_id", default=None
)
active_session_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "active_session_id", default=None
)
active_weather_emergency: contextvars.ContextVar[str | None] = (
    contextvars.ContextVar("active_weather_emergency", default=None)
)
tracer = trace.get_tracer("operio_agent.brain")


class OperioBrain:
    """Coordinates the agent reasoning loop and registers bound tool methods.

    Executes multi-turn tool calling and returns a structured timeline
    of decisions alongside the final text response.
    """

    def __init__(self, mcp_manager: McpClientManager) -> None:
        """Initializes the OperioBrain with the MCP manager and Gemini client.

        Args:
            mcp_manager: The active McpClientManager to delegate tool calls to.

        Raises:
            ValueError: If GEMINI_API_KEY is not configured in non-testing envs.
        """
        self.mcp_manager: McpClientManager = mcp_manager

        # Initialize the official Google GenAI Client
        api_key = settings.gemini_api_key
        if not api_key:
            if "pytest" in sys.modules or (
                len(sys.argv) > 0 and "pytest" in sys.argv[0]
            ):
                print(
                    "[Brain] GEMINI_API_KEY not set. Using dummy key for test collection."
                )
                self.client = genai.Client(api_key="DUMMY_KEY_FOR_TESTING")
            else:
                raise ValueError(
                    "GEMINI_API_KEY environment variable is not set. "
                    "Please configure a restricted Gemini API Key in your .env file "
                    "to enable async tool and MCP execution."
                )
        else:
            print(
                "[Brain] Initializing Gemini Developer API client using GEMINI_API_KEY..."
            )
            self.client = genai.Client(api_key=api_key)

        self.model_name: str = settings.gemini_model_name

        # Register tools
        self.tools = [
            self.search_leases,
            self.search_manuals,
            self.query_active_staff,
            self.create_work_order,
            self.update_work_order_status,
            self.check_active_work_orders,
        ]

    @staticmethod
    def _record_timeline_step(
        decisions_timeline: list[dict[str, Any]], step: dict[str, Any]
    ) -> None:
        """Appends a timeline step and mirrors it into the active trace span."""

        decisions_timeline.append(step)

        active_span = trace.get_current_span()
        if not active_span or not active_span.is_recording():
            return

        details = str(step.get("details", ""))
        active_span.add_event(
            "operio.timeline.step",
            {
                "operio.timeline.type": str(step.get("type", "")),
                "operio.timeline.title": str(step.get("title", "")),
                "operio.timeline.preview": details[:500],
            },
        )

    async def search_leases(self, query: str) -> str:
        """Search the lease agreement of the current tenant to locate liability, cost limits, and maintenance clauses.

        Only returns search results for the caller's specific lease to enforce
        tenant isolation.

        Args:
            query: The search query relating to maintenance liability or
              responsibility (e.g. 'HVAC repair', 'front glass').

        Returns:
            str: JSON string containing the search results or an error dictionary.
        """
        lease_id = active_lease_id.get()
        if not lease_id:
            return json.dumps({"error": "No active lease context found."})

        print(f"[Tool: search_leases] Query: '{query}' for Lease ID: {lease_id}")
        return await self.mcp_manager.call_tool(
            "elasticsearch", "search_leases", {"leaseId": lease_id, "query": query}
        )

    async def search_manuals(self, equipment_model: str, query: str) -> str:
        """Search manufacturer diagnostics, guides, and manuals for specific equipment models to solve diagnostic/error issues.

        Args:
            equipment_model: The brand and model code of the equipment (e.g.,
              'Carrier Model-50TJ', 'Otis Model-NPE').
            query: The diagnostic symptom or error code (e.g., 'blowing warm
              air', 'error E-04').

        Returns:
            str: JSON string containing the search results.
        """
        print(
            f"[Tool: search_manuals] Model: '{equipment_model}', Query: '{query}'"
        )
        return await self.mcp_manager.call_tool(
            "elasticsearch",
            "search_manuals",
            {"equipment_model": equipment_model, "query": query},
        )

    async def query_active_staff(self, skill: str, sector: str) -> str:
        """Find active mall maintenance technicians on-site filtered by required skill and sector proximity.

        Args:
            skill: The skill required (e.g. 'HVAC', 'Electrical', 'Plumbing',
              'Escalator').
            sector: The mall sector where help is needed (e.g. 'Sector B').

        Returns:
            str: JSON string listing matching active staff.
        """
        print(f"[Tool: query_active_staff] Skill: '{skill}', Sector: '{sector}'")
        return await self.mcp_manager.call_tool(
            "mongodb", "query_active_staff", {"skill": skill, "sector": sector}
        )

    async def check_active_work_orders(self) -> str:
        """Check for any active work orders (Pending Approval, Dispatched, or In Progress) for the current tenant.

        Returns:
            str: JSON string with active work orders or error details.
        """
        tenant_id = active_tenant_id.get()
        if not tenant_id:
            return json.dumps({"error": "No active tenant context found."})

        print(
            f"[Tool: check_active_work_orders] Checking active work orders for tenant: {tenant_id}"
        )
        return await self.mcp_manager.call_tool(
            "mongodb", "check_active_work_orders", {"tenantId": tenant_id}
        )

    async def create_work_order(
        self,
        assetId: str,
        description: str,
        costEstimation: float,
        leaseResponsibility: str,
        leaseClauseRef: str,
        emergencyLevel: str,
    ) -> str:
        """Create a new maintenance work order ticket in the database.

        The initial ticket status (Dispatched or Pending Approval) is automatically
        determined based on emergency level and liability cost limits.

        Args:
            assetId: The unique ID of the faulty equipment asset (e.g.,
              'asset_hvac_104').
            description: Detailed description of the problem.
            costEstimation: Estimated repair cost in dollars.
            leaseResponsibility: Who is liable based on the lease analysis. Must
              be either 'Landlord' or 'Tenant'.
            leaseClauseRef: Lease section referenced for the decision (e.g.,
              'Section 9.1').
            emergencyLevel: The emergency rating of the incident. Must be
              'Routine', 'Urgent', or 'Emergency'.

        Returns:
            str: JSON string response with the created work order details.
        """
        tenant_id = active_tenant_id.get()
        if not tenant_id:
            return json.dumps({"error": "No active tenant context found."})

        print(
            f"[Tool: create_work_order] Tenant: {tenant_id}, Asset: {assetId}, "
            f"Cost: ${costEstimation}, Responsibility: {leaseResponsibility}, "
            f"Level: {emergencyLevel}"
        )

        payload = {
            "tenantId": tenant_id,
            "assetId": assetId,
            "description": description,
            "costEstimation": float(costEstimation),
            "leaseResponsibility": leaseResponsibility,
            "leaseClauseRef": leaseClauseRef,
            "emergencyLevel": emergencyLevel,
            "sessionId": active_session_id.get(),
        }

        return await self.mcp_manager.call_tool(
            "mongodb", "create_work_order", payload
        )

    async def update_work_order_status(
        self, wo_id: str, status: str, technician_id: str | None = None
    ) -> str:
        """Update the status and technician assignment of an existing work order.

        Args:
            wo_id: The unique ID of the work order to update.
            status: The new status (e.g., 'Pending Approval', 'Dispatched', 'In
              Progress', 'Completed').
            technician_id: The ID of the technician being assigned (optional).

        Returns:
            str: JSON string representation of the update status.
        """
        print(
            f"[Tool: update_work_order_status] WO: {wo_id}, Status: {status}, Tech: {technician_id}"
        )

        payload: dict[str, Any] = {"wo_id": wo_id, "status": status}
        if technician_id:
            payload["technician_id"] = technician_id

        return await self.mcp_manager.call_tool(
            "mongodb", "update_work_order_status", payload
        )

    async def run_reasoning_loop(
        self, chat_history: list[dict[str, Any]], weather_context: str
    ) -> dict[str, Any]:
        """Executes the Gemini agent reasoning loop manually.

        Handles multi-turn tool calling, captures decision steps, and appends outputs.

        Args:
            chat_history: List of chat messages in format [{"role": str, "content": str}].
            weather_context: The outdoor weather conditions context string.

        Returns:
            dict[str, Any]: Dict containing response_text and decisions timeline list.
        """
        max_agent_turns = 8
        turn_count = 0
        decisions_timeline: list[dict[str, Any]] = []
        final_text = ""

        system_instruction = SYSTEM_INSTRUCTION_TEMPLATE.format(
            weather_context=weather_context
        )

        # Build active message history
        sdk_messages = []
        for msg in chat_history:
            role = msg.get("role")
            content = msg.get("content")
            if role == "user":
                sdk_messages.append(
                    types.Content(
                        role="user", parts=[types.Part.from_text(text=content)]
                    )
                )
            elif role == "model":
                sdk_messages.append(
                    types.Content(
                        role="model", parts=[types.Part.from_text(text=content)]
                    )
                )

        latest_user_message = ""
        for msg in reversed(chat_history):
            if msg.get("role") == "user":
                latest_user_message = str(msg.get("content", ""))
                break

        tool_mapping = {tool.__name__: tool for tool in self.tools}

        session_id = active_session_id.get()
        session_context = using_session(session_id) if session_id else nullcontext()

        with session_context:
            with tracer.start_as_current_span(
                "operio.reasoning_loop",
                attributes={
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: "AGENT",
                    SpanAttributes.INPUT_VALUE: latest_user_message,
                    "operio.tenant.id": active_tenant_id.get() or "",
                    "operio.lease.id": active_lease_id.get() or "",
                    "operio.weather.context": weather_context,
                },
            ) as agent_span:
                while turn_count < max_agent_turns:
                    turn_count += 1
                    print(
                        f"[Brain] Executing agent reasoning turn {turn_count}/{max_agent_turns}..."
                    )

                    # Run LLM generation
                    config = types.GenerateContentConfig(
                        tools=self.tools,
                        system_instruction=system_instruction,
                        temperature=0.2,  # Low temperature for accurate tool calls
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    )

                    response = self.client.models.generate_content(
                        model=self.model_name, contents=sdk_messages, config=config
                    )

                    # Safeguard against empty candidates
                    if not response.candidates or not response.candidates[0].content:
                        break

                    content = response.candidates[0].content

                    # Append model's output to the SDK messages list
                    sdk_messages.append(content)

                    # Check if Gemini wants to call any functions
                    function_calls = response.function_calls
                    if not function_calls:
                        # No function calls, the model gave its final answer
                        final_text = response.text or ""
                        self._record_timeline_step(
                            decisions_timeline,
                            {
                                "type": "response",
                                "title": "Final Response Formulation",
                                "details": final_text,
                            },
                        )
                        break

                    # Process function calls
                    tool_parts = []
                    for call in function_calls:
                        tool_name = call.name
                        args = call.args or {}
                        print(
                            f"[Brain] Model requested tool call: {tool_name} with args: {args}"
                        )

                        self._record_timeline_step(
                            decisions_timeline,
                            {
                                "type": "tool_call",
                                "title": f"Executing Tool: {tool_name}",
                                "details": f"Parameters: {json.dumps(args)}",
                            },
                        )

                        tool_fn = tool_mapping.get(tool_name)
                        with tracer.start_as_current_span(
                            f"tool.{tool_name}",
                            attributes={
                                SpanAttributes.OPENINFERENCE_SPAN_KIND: "TOOL",
                                "tool.name": tool_name,
                                SpanAttributes.INPUT_VALUE: json.dumps(args),
                            },
                        ) as tool_span:
                            if not tool_fn:
                                tool_output = json.dumps(
                                    {"error": f"Tool '{tool_name}' not found."}
                                )
                            else:
                                try:
                                    tool_output = await tool_fn(**args)
                                except Exception as e:
                                    tool_output = json.dumps({"error": str(e)})

                            tool_span.set_attribute(
                                SpanAttributes.OUTPUT_VALUE, str(tool_output)[:1000]
                            )

                        print(f"[Brain] Tool execution output: {tool_output}")

                        self._record_timeline_step(
                            decisions_timeline,
                            {
                                "type": "tool_result",
                                "title": f"Tool Result: {tool_name}",
                                "details": tool_output,
                            },
                        )

                        tool_parts.append(
                            types.Part.from_function_response(
                                name=tool_name, response={"result": tool_output}
                            )
                        )

                    sdk_messages.append(types.Content(role="tool", parts=tool_parts))

                else:
                    final_text = (
                        "Operational Guardrail Triggered: The maximum reasoning loop steps "
                        "were reached. Please contact property support."
                    )
                    self._record_timeline_step(
                        decisions_timeline,
                        {
                            "type": "warning",
                            "title": "Runaway Loop Aborted",
                            "details": "Agent reached max_agent_turns budget. Forcing termination.",
                        },
                    )

                agent_span.set_attribute(SpanAttributes.OUTPUT_VALUE, final_text[:1000])
                agent_span.set_attribute(
                    "operio.timeline.step_count", len(decisions_timeline)
                )

        return {"response_text": final_text, "timeline": decisions_timeline}
