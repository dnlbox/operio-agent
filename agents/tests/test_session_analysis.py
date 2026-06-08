"""Unit tests for session tagging and outcome classification helpers."""

from operio_agent.core.session_analysis import (
    build_turn_record,
    infer_request_tags,
    infer_resolution,
)


def test_infer_request_tags_for_ambiguous_lighting_case() -> None:
    """Marks lighting and ambiguity-rich conversations with the right tags."""

    timeline = [
        {
            "type": "tool_call",
            "title": "Executing Tool: search_leases",
            "details": "Parameters: {}",
        },
        {
            "type": "tool_call",
            "title": "Executing Tool: search_manuals",
            "details": "Parameters: {}",
        },
    ]

    tags = infer_request_tags(
        "Our lighting is flickering across two zones and may be a panel issue.",
        "This looks ambiguous and may require upstream panel inspection before assigning final responsibility.",
        timeline,
    )

    assert "lighting_power" in tags
    assert "ambiguous_liability" in tags
    assert "lease_reasoning" in tags
    assert "manual_diagnostics" in tags


def test_infer_resolution_for_policy_only_guidance() -> None:
    """Classifies approval-only conversations without work orders correctly."""

    resolution = infer_resolution(
        "You need written approval and a queue plan before using the corridor.",
        [
            {
                "type": "tool_call",
                "title": "Executing Tool: search_leases",
                "details": "Parameters: {}",
            }
        ],
    )

    assert resolution == "policy_guidance"


def test_build_turn_record_collects_sequence_and_resolution() -> None:
    """Builds a durable turn record for session review and Phoenix evals."""

    timeline = [
        {
            "type": "tool_call",
            "title": "Executing Tool: create_work_order",
            "details": "Parameters: {}",
        },
        {
            "type": "tool_result",
            "title": "Tool Result: create_work_order",
            "details": '{"work_order": {"status": "Pending Approval"}}',
        },
    ]

    record = build_turn_record(
        2,
        "Please help with a roof leak.",
        "I created the request and routed it for approval.",
        timeline,
    )

    assert record["turnNumber"] == 2
    assert record["resolution"] == "pending_approval"
    assert record["toolSequence"] == ["create_work_order"]
