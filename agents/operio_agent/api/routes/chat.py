"""API route for chat reasoning operations."""

import uuid
from typing import Any, Tuple
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from operio_agent.api.deps import get_brain, get_db
from operio_agent.api.schemas.chat import ChatRequest
from operio_agent.core.brain import (
    OperioBrain,
    active_lease_id,
    active_session_id,
    active_tenant_id,
    active_weather_emergency,
)

router = APIRouter()


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
async def chat_endpoint(
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
    else:
        messages = []
        # Inject welcome context or starting user message
        db.sessions.insert_one(
            {"_id": session_id, "tenantId": req.tenant_id, "messages": []}
        )

    # Append the incoming user message
    messages.append({"role": "user", "content": req.message})

    # 3. Run the Agent Loop
    try:
        result = await brain.run_reasoning_loop(messages, weather_desc)
    except Exception as e:
        print(f"[Main] Agent execution loop failed: {e}")
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")

    # 4. Save updated history to MongoDB
    messages.append({"role": "model", "content": result["response_text"]})
    db.sessions.update_one(
        {"_id": session_id}, {"$set": {"messages": messages}}
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

