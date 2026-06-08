"""Pydantic schemas for the Chat endpoints."""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Schema for chat reasoning requests."""

    tenant_id: str = Field(..., alias="tenantId")
    message: str
    session_id: Optional[str] = Field(None, alias="sessionId")
    temperature_context: Optional[str] = Field("20°C", alias="temperatureContext")
    weather_alert_context: Optional[str] = Field(None, alias="weatherAlertContext")


class ChatResponse(BaseModel):
    """Schema for chat reasoning responses."""

    session_id: str = Field(..., alias="sessionId")
    response: str
    timeline: list[dict[str, Any]] = Field(default_factory=list)
