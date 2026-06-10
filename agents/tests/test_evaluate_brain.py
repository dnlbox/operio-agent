"""Regression test for the shared scenario benchmark."""

from __future__ import annotations

import os

import pytest

from operio_agent.evals.runner import run_scenario_benchmark


@pytest.mark.asyncio
async def test_evaluation_suite() -> None:
    """Runs the shared scenarios locally and enforces the baseline accuracy gate."""
    env_scenarios = os.environ.get("SCENARIOS") or os.environ.get("SCENARIO_ID")
    scenario_ids = None
    if env_scenarios:
        scenario_ids = [
            int(value.strip())
            for value in env_scenarios.split(",")
            if value.strip().isdigit()
        ]

    env_limit = os.environ.get("LIMIT")
    limit = int(env_limit) if env_limit and env_limit.isdigit() else None

    benchmark_result = await run_scenario_benchmark(
        scenario_ids=scenario_ids,
        limit=limit,
    )

    print("\n--- Evaluation Summary ---")
    print(f"Total Scenarios Evaluated: {benchmark_result.total_scenarios}")
    print(f"Successful Runs: {benchmark_result.successful_runs}")
    print(f"Overall Accuracy: {benchmark_result.accuracy:.2f}%")

    assert benchmark_result.accuracy >= 80.0
