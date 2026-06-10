"""Local benchmark runner that turns the shared scenarios into AX-ready results."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import TYPE_CHECKING, Any, Sequence

from pymongo import MongoClient

from operio_agent.config import settings
from operio_agent.core.mcp_client import McpClientManager
from operio_agent.evals.baseline import filter_scenarios, infer_expected_scenario_metadata
from operio_agent.evals.scenarios import EVAL_SCENARIOS, FunctionCallSpec, Scenario

if TYPE_CHECKING:
    from operio_agent.core.brain import OperioBrain


mongo_client = MongoClient(settings.mongo_uri)
db = mongo_client[settings.mongo_db]


def load_brain_runtime():
    """Imports the brain runtime lazily to avoid eval CLI import side effects."""
    from operio_agent.core.brain import (
        OperioBrain,
        active_lease_id,
        active_tenant_id,
        active_weather_emergency,
    )

    return (
        OperioBrain,
        active_lease_id,
        active_tenant_id,
        active_weather_emergency,
    )


class MockContentPart:
    """Minimal content part shape compatible with the mocked GenAI response."""

    def __init__(self, function_call: Any = None, text: str | None = None):
        self.function_call = function_call
        self.text = text


class MockContent:
    """Minimal content wrapper compatible with the mocked GenAI response."""

    def __init__(self, parts: list[MockContentPart]):
        self.parts = parts


class MockCandidate:
    """Minimal candidate wrapper compatible with the mocked GenAI response."""

    def __init__(self, content: MockContent):
        self.content = content


class MockFunctionCall:
    """Minimal function-call wrapper compatible with the mocked GenAI response."""

    def __init__(self, name: str, args: dict[str, Any]):
        self.name = name
        self.args = args


class MockResponse:
    """Minimal response object consumed by the Operio reasoning loop."""

    def __init__(
        self,
        *,
        text: str = "",
        function_calls: list[FunctionCallSpec] | None = None,
    ) -> None:
        self.text = text
        self.function_calls: list[MockFunctionCall] = []
        self.candidates = [
            MockCandidate(content=MockContent(parts=[MockContentPart(text=text)]))
        ]
        if function_calls:
            self.function_calls = [
                MockFunctionCall(call["name"], call["args"]) for call in function_calls
            ]
            parts = [
                MockContentPart(function_call=function_call)
                for function_call in self.function_calls
            ]
            self.candidates = [MockCandidate(content=MockContent(parts=parts))]


@dataclass(frozen=True)
class ScenarioRunResult:
    """The local benchmark result for a single scenario."""

    scenario_id: int
    tenant_id: str
    lease_id: str
    category: str
    input_message: str
    expected_output: str
    output: str
    expected_responsibility: str
    expected_evidence: str
    expected_workflow: str
    expected_status: str
    is_ambiguous: str
    actual_responsibility: str
    actual_status: str
    db_success: bool
    scenario_passed: bool
    error_message: str

    def to_dict(self) -> dict[str, Any]:
        """Serializes the scenario result for JSON output."""
        return asdict(self)


@dataclass(frozen=True)
class BenchmarkRunResult:
    """The aggregate result of executing the shared scenario benchmark."""

    total_scenarios: int
    successful_runs: int
    accuracy: float
    scenarios: list[ScenarioRunResult]

    def to_dict(self) -> dict[str, Any]:
        """Serializes the benchmark summary for JSON output."""
        return {
            "total_scenarios": self.total_scenarios,
            "successful_runs": self.successful_runs,
            "accuracy": self.accuracy,
            "scenarios": [scenario.to_dict() for scenario in self.scenarios],
        }


def build_experiment_run_rows(
    benchmark_result: BenchmarkRunResult,
    *,
    example_id_by_scenario_id: dict[int, str],
) -> list[dict[str, Any]]:
    """Builds AX experiment run rows once dataset example IDs are known."""
    rows: list[dict[str, Any]] = []
    for scenario_result in benchmark_result.scenarios:
        example_id = example_id_by_scenario_id[scenario_result.scenario_id]
        rows.append(
            {
                "example_id": example_id,
                "output": scenario_result.output,
                "scenario_id": scenario_result.scenario_id,
                "category": scenario_result.category,
                "db_success": scenario_result.db_success,
                "scenario_passed": scenario_result.scenario_passed,
                "error_message": scenario_result.error_message,
                "actual_status": scenario_result.actual_status,
                "actual_responsibility": scenario_result.actual_responsibility,
                "expected_status": scenario_result.expected_status,
                "expected_responsibility": scenario_result.expected_responsibility,
            }
        )
    return rows


async def run_scenario_benchmark(
    *,
    scenarios: Sequence[Scenario] = EVAL_SCENARIOS,
    scenario_ids: Sequence[int] | None = None,
    limit: int | None = None,
) -> BenchmarkRunResult:
    """Runs the local mocked benchmark and returns a scenario-by-scenario summary."""
    selected_scenarios = filter_scenarios(
        scenarios,
        scenario_ids=scenario_ids,
        limit=limit,
    )
    operio_brain_class, _, _, _ = load_brain_runtime()
    original_backend = settings.reasoning_backend
    settings.reasoning_backend = "legacy"
    mcp_manager = McpClientManager()
    await mcp_manager.start()
    try:
        brain = operio_brain_class(mcp_manager)
        results: list[ScenarioRunResult] = []
        success_count = 0
        for scenario in selected_scenarios:
            result = await _run_single_scenario(
                brain=brain,
                scenario=scenario,
            )
            results.append(result)
            if result.scenario_passed:
                success_count += 1

        total = len(selected_scenarios)
        accuracy = (success_count / total) * 100 if total else 0.0
        return BenchmarkRunResult(
            total_scenarios=total,
            successful_runs=success_count,
            accuracy=accuracy,
            scenarios=results,
        )
    finally:
        await mcp_manager.stop()
        settings.reasoning_backend = original_backend


async def _run_single_scenario(
    *,
    brain: OperioBrain,
    scenario: Scenario,
) -> ScenarioRunResult:
    """Runs one scenario through the mocked reasoning loop."""
    expectation = infer_expected_scenario_metadata(scenario)
    _, active_lease_id, active_tenant_id, active_weather_emergency = (
        load_brain_runtime()
    )

    active_tenant_id.set(scenario["tenant_id"])
    active_lease_id.set(scenario["lease_id"])

    is_winter = "EMERGENCY" in scenario["message"]
    temp = "-22°C" if is_winter else "20°C"
    alert = "Extreme Cold Alert" if is_winter else None
    weather_desc = f"Outdoor Temp: {temp}"
    if alert:
        weather_desc += f" | WARNING: {alert}"
    active_weather_emergency.set(weather_desc)

    turn_index = 0

    def mock_generate_content(model: Any, contents: Any, config: Any = None) -> MockResponse:
        del model, contents, config
        nonlocal turn_index
        if turn_index >= len(scenario["mock_turns"]):
            return MockResponse(text="Loop finished.")

        turn = scenario["mock_turns"][turn_index]
        turn_index += 1
        if turn["type"] == "tool":
            return MockResponse(function_calls=turn["calls"])
        return MockResponse(text=turn["text"])

    brain.client.models.generate_content = mock_generate_content
    history = [{"role": "user", "content": scenario["message"]}]

    db_success = False
    actual_status = ""
    actual_responsibility = ""
    output = ""
    error_message = ""

    try:
        result = await brain.run_reasoning_loop(history, weather_desc)
        work_order = db.work_orders.find_one(
            {"tenantId": scenario["tenant_id"]},
            sort=[("_id", -1)],
        )

        if work_order:
            actual_status = str(work_order.get("status", ""))
            actual_responsibility = str(work_order.get("leaseResponsibility", ""))
            status_ok = (
                actual_status == expectation.status if expectation.status else True
            )
            responsibility_ok = (
                actual_responsibility == expectation.responsibility
                if expectation.responsibility != "Unknown"
                else True
            )
            db_success = status_ok and responsibility_ok
            db.work_orders.delete_one({"_id": work_order["_id"]})
        else:
            db_success = expectation.status is None

        output = str(result["response_text"])
    except Exception as exc:
        error_message = str(exc)
        output = f"Error: {exc}"

    return ScenarioRunResult(
        scenario_id=scenario["id"],
        tenant_id=scenario["tenant_id"],
        lease_id=scenario["lease_id"],
        category=scenario["category"],
        input_message=scenario["message"],
        expected_output=expectation.expected_output,
        output=output,
        expected_responsibility=expectation.responsibility,
        expected_evidence=expectation.evidence,
        expected_workflow=expectation.workflow,
        expected_status=expectation.status or "",
        is_ambiguous=expectation.is_ambiguous,
        actual_responsibility=actual_responsibility,
        actual_status=actual_status,
        db_success=db_success,
        scenario_passed=db_success,
        error_message=error_message,
    )
