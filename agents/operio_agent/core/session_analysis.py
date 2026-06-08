"""Helpers for tagging and storing rich chat session outcomes."""

from __future__ import annotations

import json
from typing import Any


def _has_keyword(text: str, keywords: list[str]) -> bool:
    """Checks whether any keyword appears in normalized text."""

    normalized = text.lower()
    return any(keyword in normalized for keyword in keywords)


def extract_tool_sequence(timeline: list[dict[str, Any]]) -> list[str]:
    """Extracts the ordered list of tool names from the reasoning timeline."""

    sequence: list[str] = []
    for step in timeline:
        if step.get("type") != "tool_call":
            continue

        title = step.get("title", "")
        if "Executing Tool:" not in title:
            continue
        sequence.append(title.split("Executing Tool:", maxsplit=1)[1].strip())
    return sequence


def infer_request_tags(
    message: str, response_text: str, timeline: list[dict[str, Any]]
) -> list[str]:
    """Infers high-signal tags for a chat turn from the message and timeline."""

    tags = {"tenant_chat"}
    combined = f"{message} {response_text}"
    tool_sequence = extract_tool_sequence(timeline)

    if _has_keyword(
        combined,
        ["repair", "broken", "flicker", "flickering", "warm air", "leak", "error"],
    ):
        tags.add("maintenance")

    if _has_keyword(
        combined,
        ["event", "launch", "drop", "queue", "corridor", "lineup", "activation"],
    ):
        tags.update({"policy_request", "event_ops"})

    if _has_keyword(
        combined,
        ["lighting", "lights", "bulb", "ballast", "voltage", "panel", "flicker"],
    ):
        tags.add("lighting_power")

    if _has_keyword(
        combined,
        [
            "ambiguous",
            "unclear",
            "determine whether",
            "before assigning responsibility",
            "inspect upstream",
            "demarcation",
        ],
    ):
        tags.add("ambiguous_liability")

    if "search_manuals" in tool_sequence:
        tags.add("manual_diagnostics")

    if "search_leases" in tool_sequence:
        tags.add("lease_reasoning")

    if "create_work_order" in tool_sequence:
        tags.add("dispatch_candidate")

    return sorted(tags)


def infer_resolution(
    response_text: str, timeline: list[dict[str, Any]]
) -> str:
    """Infers the operational resolution of a turn for later evaluation."""

    tool_sequence = extract_tool_sequence(timeline)
    response_lower = response_text.lower()

    if "duplicate" in response_lower and "create_work_order" not in tool_sequence:
        return "duplicate_prevented"

    if "create_work_order" not in tool_sequence:
        if any(
            keyword in response_lower
            for keyword in ["written approval", "queue plan", "event plan", "landlord approval"]
        ):
            return "policy_guidance"
        return "guidance_only"

    for step in timeline:
        if step.get("type") != "tool_result":
            continue
        title = step.get("title", "")
        if "create_work_order" not in title:
            continue
        try:
            payload = json.loads(step.get("details", "{}"))
        except json.JSONDecodeError:
            continue

        work_order = payload.get("work_order") or payload.get("ticket") or {}
        status = work_order.get("status", "")
        if status == "Pending Approval":
            return "pending_approval"
        if status == "Dispatched":
            return "auto_dispatched"
        if status == "Created":
            return "created_unassigned"

    return "work_order_created"


def build_turn_record(
    turn_number: int,
    user_message: str,
    response_text: str,
    timeline: list[dict[str, Any]],
) -> dict[str, Any]:
    """Builds a persisted turn record used for session review and evals."""

    return {
        "turnNumber": turn_number,
        "userMessage": user_message,
        "responseText": response_text,
        "timeline": timeline,
        "toolSequence": extract_tool_sequence(timeline),
        "tags": infer_request_tags(user_message, response_text, timeline),
        "resolution": infer_resolution(response_text, timeline),
    }
