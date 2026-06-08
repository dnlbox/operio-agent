"""API routes for staff maintenance technicians management."""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from operio_agent.api.deps import get_db
from operio_agent.api.schemas.staff import StaffUpdateRequest

router = APIRouter()


@router.get("/staff")
def get_staff(db: Database = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieves all staff technicians from the database.

    Args:
        db: Injected MongoDB database.

    Returns:
        list[dict[str, Any]]: List of technician dicts.
    """
    staff = list(db.staff.find({}))
    for s in staff:
        s["_id"] = str(s["_id"])
    return staff


@router.patch("/staff/{staff_id}")
def update_staff(
    staff_id: str,
    req: StaffUpdateRequest,
    db: Database = Depends(get_db),
) -> dict[str, Any]:
    """Updates technical schedule, location status, or skills for a staff member.

    Args:
        staff_id: Unique string identifier of the technician.
        req: Pydantic update payload schema.
        db: Injected MongoDB database.

    Returns:
        dict[str, Any]: The updated technician document.

    Raises:
        HTTPException: If payload is empty or staff is not found.
    """
    update_fields: dict[str, Any] = {}
    if req.status is not None:
        update_fields["status"] = req.status
    if req.shift_start is not None:
        update_fields["shiftStart"] = req.shift_start
    if req.shift_end is not None:
        update_fields["shiftEnd"] = req.shift_end
    if req.current_location is not None:
        update_fields["currentLocation"] = req.current_location
    if req.skills is not None:
        update_fields["skills"] = req.skills

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.staff.find_one_and_update(
        {"_id": staff_id}, {"$set": update_fields}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Staff member not found")

    result["_id"] = str(result["_id"])
    return result
