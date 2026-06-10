"""API route for chat reasoning operations."""

import uuid
from datetime import datetime, timezone
from typing import Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, Request
from opentelemetry import trace
from pymongo.database import Database
from phoenix.otel import SpanAttributes, using_session

from operio_agent.api.deps import get_brain, get_db, limiter
from operio_agent.api.schemas.chat import ChatRequest
from operio_agent.config import settings
from operio_agent.core.session_analysis import build_turn_record
from operio_agent.core.brain import (
    OperioBrain,
    active_lease_id,
    active_session_id,
    active_tenant_id,
    active_weather_emergency,
)

# NOTE: When a POST /api/docs/upload endpoint is added it should carry a
# stricter per-IP limit, e.g.:
#   @limiter.limit("5/hour")
# to guard against Vertex AI document-processing costs.

router = APIRouter()
tracer = trace.get_tracer("operio_agent.chat")


def get_tenant_lease_context(db: Database, tenant_id: str) -> Tuple[str, str]:
    """Retrieves the lease ID and store name associated with a tenant.

    Args:
        db: The active MongoDB database object.
        tenant_id: The ID of the tenant.

    Returns:
        Tuple[str, str]: The lease ID and the store name.

    Raises:
        HTTPException: If the tenant does not exist.
    """
    tenant = db.tenants.find_one({"_id": tenant_id})
    if not tenant:
        raise HTTPException(
            status_code=404, detail=f"Tenant '{tenant_id}' not found."
        )
    return tenant.get("leaseId", ""), tenant.get("storeName", "")


@router.post("/chat")
@limiter.limit(lambda: settings.chat_rate_limit_per_day)
@limiter.limit(lambda: settings.chat_rate_limit_per_minute)
async def chat_endpoint(
    request: Request,
    req: ChatRequest,
    db: Database = Depends(get_db),
    brain: OperioBrain = Depends(get_brain),
) -> dict[str, Any]:
    """Handles chat messages, runs reasoning loop, and updates session history.

    Args:
        req: The incoming ChatRequest schema.
        db: Injected MongoDB database.
        brain: Injected OperioBrain reasoning instance.

    Returns:
        dict[str, Any]: Dictionary with sessionId, response text, and timeline.

    Raises:
        HTTPException: If the agent reasoning loop fails.
    """
    # 1. Resolve security parameters (tenantId and leaseId)
    lease_id, _ = get_tenant_lease_context(db, req.tenant_id)

    # Set thread-local context variables for secure database isolation
    active_tenant_id.set(req.tenant_id)
    active_lease_id.set(lease_id)

    # Format weather instructions
    weather_desc = f"Outdoor Temp: {req.temperature_context}"
    if req.weather_alert_context:
        weather_desc += f" | WARNING: {req.weather_alert_context}"
    active_weather_emergency.set(weather_desc)

    # 2. Load or initialize session history from MongoDB
    session_id = req.session_id or str(uuid.uuid4())
    active_session_id.set(session_id)

    session = db.sessions.find_one({"_id": session_id})

    if session:
        messages = session.get("messages", [])
        turns = session.get("turns", [])
    else:
        messages = []
        turns = []
        # Inject welcome context or starting user message
        db.sessions.insert_one(
            {"_id": session_id, "tenantId": req.tenant_id, "messages": [], "turns": []}
        )

    # Append the incoming user message
    messages.append({"role": "user", "content": req.message})
    turn_number = sum(1 for message in messages if message.get("role") == "user")

    # 3. Run the Agent Loop
    span_id = None
    expected_resp = "Unknown"
    is_ambiguous_str = "no"
    expected_evidence_str = "none"
    try:
        with using_session(session_id):
            with tracer.start_as_current_span(
                "operio.chat_turn",
                attributes={
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: "CHAIN",
                    SpanAttributes.SESSION_ID: session_id,
                    SpanAttributes.INPUT_VALUE: req.message,
                    "operio.tenant.id": req.tenant_id,
                    "operio.lease.id": lease_id,
                    "operio.turn.number": turn_number,
                    "operio.weather.context": weather_desc,
                },
            ) as turn_span:
                result = await brain.run_reasoning_loop(messages, weather_desc)
                turn_record = build_turn_record(
                    turn_number, req.message, result["response_text"], result["timeline"]
                )
                turn_span.set_attribute(
                    SpanAttributes.OUTPUT_VALUE, result["response_text"][:1000]
                )
                turn_span.set_attribute(
                    "operio.turn.resolution", turn_record["resolution"]
                )
                turn_span.set_attribute(
                    "operio.turn.tags", ",".join(turn_record["tags"])
                )

                # Derive and log evaluation targets as span attributes for Arize AX mapping
                if "Tenant" in result["response_text"]:
                    expected_resp = "Tenant"
                elif "Landlord" in result["response_text"]:
                    expected_resp = "Landlord"
                else:
                    expected_resp = "Unknown"

                is_ambiguous_str = (
                    "yes" if "ambiguous_liability" in turn_record["tags"] else "no"
                )

                if "lease_reasoning" in turn_record["tags"]:
                    expected_evidence_str = "lease clause"
                elif "manual_diagnostics" in turn_record["tags"]:
                    expected_evidence_str = "manual section"
                else:
                    expected_evidence_str = "none"

                turn_span.set_attribute("operio.expected_responsibility", expected_resp)
                turn_span.set_attribute("operio.expected_evidence", expected_evidence_str)
                turn_span.set_attribute("operio.is_ambiguous", is_ambiguous_str)
                turn_span.set_attribute("operio.expected_workflow", turn_record["resolution"])

                span_context = turn_span.get_span_context()
                if span_context.is_valid:
                    span_id = format(span_context.span_id, "016x")
    except Exception as e:
        print(f"[Main] Agent execution loop failed: {e}")
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")

    # Trigger evaluations in the background if tracing was successful
    if span_id:
        from operio_agent.evals.live_trace import run_live_eval_and_log

        history_messages = messages[:-1]
        history_summary = (
            "\n".join(
                f"{message['role']}: {message['content']}"
                for message in history_messages[-4:]
            )
            if history_messages
            else "None"
        )

        run_live_eval_and_log(
            span_id=span_id,
            user_message=req.message,
            response_text=result["response_text"],
            history_summary=history_summary,
            expected_responsibility=expected_resp,
            expected_evidence=expected_evidence_str,
            is_ambiguous=is_ambiguous_str,
            expected_workflow=turn_record["resolution"],
        )

    # 4. Save updated history to MongoDB
    messages.append({"role": "model", "content": result["response_text"]})
    turns.append(turn_record)
    db.sessions.update_one(
        {
            "_id": session_id
        },
        {
            "$set": {
                "tenantId": req.tenant_id,
                "messages": messages,
                "turns": turns,
                "lastTags": turn_record["tags"],
                "lastResolution": turn_record["resolution"],
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {
        "sessionId": session_id,
        "response": result["response_text"],
        "timeline": result["timeline"],
    }


@router.get("/sessions/{session_id}")
def get_session(session_id: str, db: Database = Depends(get_db)) -> dict[str, Any]:
    """Retrieves the support chat history messages that triggered a work order.

    Args:
        session_id: The unique ID of the session.
        db: Injected MongoDB database.

    Returns:
        dict[str, Any]: The session object.

    Raises:
        HTTPException: If the session is not found.
    """
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session["_id"] = str(session["_id"])
    return session
