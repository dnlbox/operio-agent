"""Pydantic schemas for Staff endpoints."""

from typing import List, Optional
from pydantic import BaseModel, Field


class StaffUpdateRequest(BaseModel):
    """Schema for updating staff technicians details."""

    status: Optional[str] = None
    shift_start: Optional[str] = Field(None, alias="shiftStart")
    shift_end: Optional[str] = Field(None, alias="shiftEnd")
    current_location: Optional[str] = Field(None, alias="currentLocation")
    skills: Optional[List[str]] = None
