"""Pydantic schemas for Work Order Tickets endpoints."""

from typing import Optional
from pydantic import BaseModel, Field


class HitlApprovalRequest(BaseModel):
    """Schema for human-in-the-loop work order approval."""

    assigned_to: Optional[str] = Field(None, alias="assignedTo")
    cost_estimation: Optional[float] = Field(None, alias="costEstimation")
    manager_notes: Optional[str] = Field(None, alias="managerNotes")


class WorkOrderCompletionRequest(BaseModel):
    """Schema for field completion of an assigned work order."""

    completed_by: str = Field(..., alias="completedBy")
    completion_notes: Optional[str] = Field(None, alias="completionNotes")
