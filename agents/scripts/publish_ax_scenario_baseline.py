"""Publish the shared scenario baseline to Arize AX via the ax CLI."""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime
from pathlib import Path

from operio_agent.evals.ax_publish import (
    ArtifactPaths,
    publish_scenario_baseline,
)
from operio_agent.evals.baseline import filter_scenarios
from operio_agent.evals.utils import parse_scenario_ids


REPO_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    """Parses command-line options for publishing the baseline."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    parser = argparse.ArgumentParser(
        description="Create or reuse an AX dataset and publish a scenario baseline experiment.",
    )
    parser.add_argument(
        "--space",
        required=True,
        help="Arize AX space name or ID.",
    )
    parser.add_argument(
        "--dataset-name",
        default="operio-scenario-baseline",
        help="Dataset name to create or reuse in AX.",
    )
    parser.add_argument(
        "--experiment-name",
        default=f"operio-scenario-baseline-{timestamp}",
        help="Experiment name to create in AX.",
    )
    parser.add_argument(
        "--dataset-output",
        type=Path,
        default=REPO_ROOT / "agents" / "demo" / "operio_ax_eval_dataset.csv",
        help="Local dataset artifact path.",
    )
    parser.add_argument(
        "--runs-output",
        type=Path,
        default=REPO_ROOT / "agents" / "demo" / "operio_ax_experiment_runs.json",
        help="Local experiment runs artifact path.",
    )
    parser.add_argument(
        "--annotations-output",
        type=Path,
        default=REPO_ROOT / "agents" / "demo" / "operio_ax_run_annotations.json",
        help="Local run annotations artifact path.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional maximum number of scenarios to publish.",
    )
    parser.add_argument(
        "--scenario-ids",
        type=str,
        default="",
        help="Comma-separated list of scenario IDs to publish.",
    )
    parser.add_argument(
        "--skip-annotations",
        action="store_true",
        help="Skip annotating experiment runs with the deterministic db_correctness signal.",
    )
    return parser.parse_args()


async def _main() -> None:
    args = parse_args()
    selected_scenarios = filter_scenarios(
        scenario_ids=parse_scenario_ids(args.scenario_ids) or None,
        limit=args.limit,
    )
    summary = await publish_scenario_baseline(
        space=args.space,
        dataset_name=args.dataset_name,
        experiment_name=args.experiment_name,
        scenarios=selected_scenarios,
        artifacts=ArtifactPaths(
            dataset_output=args.dataset_output,
            benchmark_output=args.dataset_output.parent
            / "operio_ax_baseline_results.json",
            experiment_runs_output=args.runs_output,
            run_annotations_output=args.annotations_output,
        ),
        annotate_runs=not args.skip_annotations,
    )

    print(f"Published dataset: {summary.dataset_name}")
    print(f"Published experiment: {summary.experiment_name}")
    print(f"Scenario accuracy: {summary.accuracy:.2f}%")
    print(f"Dataset artifact: {summary.artifacts.dataset_output}")
    print(f"Benchmark artifact: {summary.artifacts.benchmark_output}")
    print(f"Experiment runs artifact: {summary.artifacts.experiment_runs_output}")
    if not args.skip_annotations:
        print(
            "Run annotations artifact: "
            f"{summary.artifacts.run_annotations_output}"
        )


if __name__ == "__main__":
    asyncio.run(_main())
