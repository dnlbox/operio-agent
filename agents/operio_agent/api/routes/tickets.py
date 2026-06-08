"""API routes for work order tickets management."""

from typing import Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from operio_agent.api.deps import get_db
from operio_agent.api.schemas.tickets import HitlApprovalRequest

router = APIRouter()


@router.get("/tickets")
def get_tickets(db: Database = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieves all work order tickets from the database.

    Args:
        db: Injected MongoDB database.

    Returns:
        list[dict[str, Any]]: List of work order ticket dictionaries.
    """
    tickets = list(db.work_orders.find({}))
    # Normalize MongoDB ObjectIds to strings
    for ticket in tickets:
        ticket["_id"] = str(ticket["_id"])
    return tickets


@router.post("/tickets/{ticket_id}/approve")
def approve_ticket(
    ticket_id: str,
    approval: HitlApprovalRequest,
    db: Database = Depends(get_db),
) -> dict[str, Any]:
    """Approves a work order ticket and dispatches the assigned technician.

    Args:
        ticket_id: The ID of the ticket to approve.
        approval: The schema containing assignee, cost estimate, and notes.
        db: Injected MongoDB database.

    Returns:
        dict[str, Any]: Dictionary indicating success and the updated ticket details.

    Raises:
        HTTPException: If the work order ticket is not found.
    """
    print(f"[API] Approving ticket {ticket_id} with data: {approval}")

    update_fields: dict[str, Any] = {
        "status": "Dispatched",
        "externalSystemPayload.action": "CREATE_AND_DISPATCH",
    }

    if approval.assigned_to:
        update_fields["assignedTo"] = approval.assigned_to
    if approval.cost_estimation is not None:
        update_fields["costEstimation"] = approval.cost_estimation
    if approval.manager_notes:
        update_fields["managerNotes"] = approval.manager_notes

    try:
        query_id = ObjectId(ticket_id)
    except Exception:
        query_id = ticket_id  # type: ignore # Fallback for string keys in mock tests

    # Push to timeline
    result = db.work_orders.find_one_and_update(
        {"_id": query_id},
        {
            "$set": update_fields,
            "$push": {
                "timeline": {
                    "status": "Dispatched (Approved by Manager)",
                    "timestamp": "2026-06-05T15:55:00Z",  # Mock standard time
                    "notes": approval.manager_notes or "Approved via command control",
                }
            },
        },
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=404, detail="Work order ticket not found."
        )

    result["_id"] = str(result["_id"])

    # Dynamic resume notification: Inject a system message to session history
    # representing that the agent was notified of approval and dispatched the contractor
    latest_session = db.sessions.find_one(
        {"tenantId": result["tenantId"]}, sort=[("_id", -1)]
    )
    if latest_session:
        session_messages = latest_session.get("messages", [])
        assigned_name = approval.assigned_to or "Sarah Connor"
        confirm_text = (
            f"[SYSTEM NOTICE]: Work order {ticket_id} has been approved by management. "
            f"Technician has been dispatched. Assigned contractor: {assigned_name}. "
            f"Notes: {approval.manager_notes or 'None'}"
        )
        session_messages.append({"role": "user", "content": confirm_text})
        session_messages.append(
            {
                "role": "model",
                "content": (
                    f"Acknowledged. I have updated the tenant record. "
                    f"Dispatcher confirmed for {assigned_name}."
                ),
            }
        )
        db.sessions.update_one(
            {"_id": latest_session["_id"]},
            {"$set": {"messages": session_messages}},
        )

    return {"success": True, "ticket": result}


@router.post("/tickets/{ticket_id}/reject")
def reject_ticket(
    ticket_id: str, db: Database = Depends(get_db)
) -> dict[str, Any]:
    """Rejects or cancels a work order ticket.

    Args:
        ticket_id: The ID of the ticket to reject.
        db: Injected MongoDB database.

    Returns:
        dict[str, Any]: Dictionary indicating success and the updated ticket details.

    Raises:
        HTTPException: If the work order ticket is not found.
    """
    print(f"[API] Rejecting ticket {ticket_id}")

    try:
        query_id = ObjectId(ticket_id)
    except Exception:
        query_id = ticket_id  # type: ignore

    result = db.work_orders.find_one_and_update(
        {"_id": query_id},
        {
            "$set": {
                "status": "Rejected",
                "externalSystemPayload.action": "CANCEL_WORK_ORDER",
            },
            "$push": {
                "timeline": {
                    "status": "Rejected",
                    "timestamp": "2026-06-05T15:55:00Z",
                }
            },
        },
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=404, detail="Work order ticket not found."
        )

    result["_id"] = str(result["_id"])
    return {"success": True, "ticket": result}
