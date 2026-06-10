"""Pure helpers for deriving AX-friendly baseline data from the scenario corpus."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Iterable, Sequence

from operio_agent.evals.scenarios import EVAL_SCENARIOS, Scenario


@dataclass(frozen=True)
class ScenarioExpectation:
    """Expected benchmark metadata derived from a scenario definition."""

    responsibility: str
    evidence: str
    workflow: str
    status: str | None
    is_ambiguous: str
    expected_output: str


def get_expected_output(scenario: Scenario) -> str:
    """Returns the final mocked assistant response for a scenario."""
    text_turns = [
        turn["text"] for turn in scenario["mock_turns"] if turn["type"] == "text"
    ]
    return text_turns[-1] if text_turns else ""


def infer_expected_scenario_metadata(scenario: Scenario) -> ScenarioExpectation:
    """Infers the expected responsibility and workflow for a scenario."""
    responsibility = "Unknown"
    evidence = "none"
    workflow = "policy_guidance"
    status: str | None = None

    for turn in scenario["mock_turns"]:
        if turn["type"] != "tool":
            continue
        for call in turn["calls"]:
            if call["name"] != "create_work_order":
                continue
            args = call["args"]
            responsibility = str(args.get("leaseResponsibility", "Unknown"))
            evidence = str(args.get("leaseClauseRef", "none"))
            cost = float(args.get("costEstimation", 0.0))
            emergency = str(args.get("emergencyLevel", "Routine"))

            if emergency == "Emergency":
                status = "Dispatched"
                workflow = "auto_dispatched"
            elif responsibility == "Tenant":
                status = "Dispatched"
                workflow = "auto_dispatched"
            elif responsibility == "Landlord" and cost <= 150.0:
                status = "Dispatched"
                workflow = "auto_dispatched"
            else:
                status = "Pending Approval"
                workflow = "pending_approval"

    scenario_id = scenario["id"]
    if scenario_id == 6:
        responsibility = "Unknown"
        evidence = "Carrier Model-50TJ"
        workflow = "guidance_only"
    elif scenario_id == 9:
        responsibility = "Unknown"
        evidence = "Section 9.2"
        workflow = "policy_guidance"
    elif scenario_id == 10:
        responsibility = "Unknown"
        evidence = "Section 13.1"
        workflow = "policy_guidance"
    elif scenario_id == 11:
        responsibility = "Unknown"
        evidence = "Section 11.3"
        workflow = "policy_guidance"
    elif scenario_id == 12:
        responsibility = "Unknown"
        evidence = "Section 13.1"
        workflow = "policy_guidance"

    is_ambiguous = (
        "yes"
        if scenario["category"] in ("Ambiguous Liability", "Demarcation")
        else "no"
    )
    return ScenarioExpectation(
        responsibility=responsibility,
        evidence=evidence,
        workflow=workflow,
        status=status,
        is_ambiguous=is_ambiguous,
        expected_output=get_expected_output(scenario),
    )


def filter_scenarios(
    scenarios: Sequence[Scenario] = EVAL_SCENARIOS,
    *,
    scenario_ids: Iterable[int] | None = None,
    limit: int | None = None,
) -> list[Scenario]:
    """Filters the shared scenario set for local runs or dataset exports."""
    selected = list(scenarios)
    if scenario_ids is not None:
        selected_ids = {int(scenario_id) for scenario_id in scenario_ids}
        selected = [
            scenario for scenario in selected if scenario["id"] in selected_ids
        ]
    if limit is not None:
        selected = selected[:limit]
    return selected


def build_ax_dataset_rows(
    scenarios: Sequence[Scenario] = EVAL_SCENARIOS,
) -> list[dict[str, Any]]:
    """Builds rows for an AX dataset from the benchmark scenarios."""
    rows: list[dict[str, Any]] = []
    for scenario in scenarios:
        expectation = infer_expected_scenario_metadata(scenario)
        rows.append(
            {
                "scenario_id": scenario["id"],
                "tenant_id": scenario["tenant_id"],
                "lease_id": scenario["lease_id"],
                "category": scenario["category"],
                "attributes.input.value": scenario["message"],
                "attributes.output.value": expectation.expected_output,
                "history": f"user: {scenario['message']}",
                "expected_responsibility": expectation.responsibility,
                "expected_evidence": expectation.evidence,
                "is_ambiguous": expectation.is_ambiguous,
                "expected_workflow": expectation.workflow,
                "expected_status": expectation.status or "",
            }
        )
    return rows


def build_ax_dataset_records(
    scenarios: Sequence[Scenario] = EVAL_SCENARIOS,
) -> list[dict[str, Any]]:
    """Builds JSON-friendly dataset records from the scenario corpus."""
    return [dict(row) for row in build_ax_dataset_rows(scenarios)]


def build_expectation_index(
    scenarios: Sequence[Scenario] = EVAL_SCENARIOS,
) -> dict[int, ScenarioExpectation]:
    """Indexes expectations by scenario ID for later experiment joins."""
    return {
        scenario["id"]: infer_expected_scenario_metadata(scenario)
        for scenario in scenarios
    }


def expectation_to_dict(expectation: ScenarioExpectation) -> dict[str, Any]:
    """Converts a scenario expectation into a serializable dictionary."""
    return asdict(expectation)
