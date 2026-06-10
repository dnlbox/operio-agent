"""Run the shared Operio benchmark scenarios locally and write JSON results."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from operio_agent.evals.ax_publish import write_benchmark_artifact
from operio_agent.evals.runner import run_scenario_benchmark
from operio_agent.evals.utils import parse_scenario_ids


REPO_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    """Parses command-line options for the local scenario benchmark."""
    parser = argparse.ArgumentParser(
        description="Run Operio's shared scenario baseline locally.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "agents" / "demo" / "operio_ax_baseline_results.json",
        help="Destination file path for the benchmark summary.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional maximum number of scenarios to run.",
    )
    parser.add_argument(
        "--scenario-ids",
        type=str,
        default="",
        help="Comma-separated list of scenario IDs to run.",
    )
    return parser.parse_args()


async def _main() -> None:
    args = parse_args()
    benchmark_result = await run_scenario_benchmark(
        scenario_ids=parse_scenario_ids(args.scenario_ids) or None,
        limit=args.limit,
    )
    write_benchmark_artifact(
        output_path=args.output,
        benchmark_result=benchmark_result,
    )
    print(f"Accuracy: {benchmark_result.accuracy:.2f}%")
    print(f"Wrote benchmark summary to {args.output}")


if __name__ == "__main__":
    asyncio.run(_main())
