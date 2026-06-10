"""Export the shared Operio benchmark scenarios into an AX dataset artifact."""

from __future__ import annotations

import argparse
from pathlib import Path

from operio_agent.evals.ax_publish import export_dataset_artifact
from operio_agent.evals.baseline import filter_scenarios
from operio_agent.evals.utils import parse_scenario_ids


REPO_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    """Parses command-line options for dataset export."""
    parser = argparse.ArgumentParser(
        description="Export Operio's shared eval scenarios into an Arize AX dataset file.",
    )
    parser.add_argument(
        "--format",
        choices=("csv", "jsonl"),
        default="csv",
        help="Output format for the dataset export.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "agents" / "demo" / "operio_ax_eval_dataset.csv",
        help="Destination file path.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional maximum number of scenarios to export.",
    )
    parser.add_argument(
        "--scenario-ids",
        type=str,
        default="",
        help="Comma-separated list of scenario IDs to export.",
    )
    return parser.parse_args()


def main() -> None:
    """Writes the exported dataset to disk."""
    args = parse_args()
    selected_scenarios = filter_scenarios(
        scenario_ids=parse_scenario_ids(args.scenario_ids) or None,
        limit=args.limit,
    )
    export_dataset_artifact(
        output_path=args.output,
        scenarios=selected_scenarios,
        file_format=args.format,
    )
    print(f"Wrote {len(selected_scenarios)} AX dataset rows to {args.output}")


if __name__ == "__main__":
    main()
