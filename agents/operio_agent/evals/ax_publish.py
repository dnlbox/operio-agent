"""Arize AX publishing helpers for the shared scenario baseline."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import pandas as pd

from operio_agent.evals.baseline import build_ax_dataset_rows
from operio_agent.evals.runner import (
    BenchmarkRunResult,
    build_experiment_run_rows,
    run_scenario_benchmark,
)
from operio_agent.evals.scenarios import Scenario
from operio_agent.evals.utils import write_json


@dataclass(frozen=True)
class ArtifactPaths:
    """File paths written by the scenario baseline flow."""

    dataset_output: Path
    benchmark_output: Path
    experiment_runs_output: Path
    run_annotations_output: Path


@dataclass(frozen=True)
class PublishedDataset:
    """A dataset published to AX plus the example IDs for each scenario."""

    name: str
    example_id_by_scenario_id: dict[int, str]


@dataclass(frozen=True)
class PublishSummary:
    """Outcome of publishing the scenario baseline to Arize AX."""

    dataset_name: str
    experiment_name: str
    accuracy: float
    artifacts: ArtifactPaths


def export_dataset_artifact(
    *,
    output_path: Path,
    scenarios: Sequence[Scenario],
    file_format: str = "csv",
) -> None:
    """Writes the shared scenario corpus as an AX dataset artifact."""
    dataframe = pd.DataFrame(build_ax_dataset_rows(scenarios))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if file_format == "csv":
        dataframe.to_csv(output_path, index=False)
    elif file_format == "jsonl":
        dataframe.to_json(output_path, orient="records", lines=True)
    else:
        raise ValueError(f"Unsupported dataset artifact format: {file_format}")


def write_benchmark_artifact(
    *,
    output_path: Path,
    benchmark_result: BenchmarkRunResult,
) -> None:
    """Writes the local scenario benchmark summary to disk."""
    write_json(output_path, benchmark_result.to_dict())


async def publish_scenario_baseline(
    *,
    space: str,
    dataset_name: str,
    experiment_name: str,
    scenarios: Sequence[Scenario],
    artifacts: ArtifactPaths,
    annotate_runs: bool,
) -> PublishSummary:
    """Publishes the shared scenario baseline to Arize AX."""
    selected_ids = {scenario["id"] for scenario in scenarios}

    export_dataset_artifact(
        output_path=artifacts.dataset_output,
        scenarios=scenarios,
        file_format="csv",
    )
    published_dataset = resolve_dataset(
        space=space,
        dataset_name=dataset_name,
        dataset_output=artifacts.dataset_output,
        scenario_ids=selected_ids,
    )

    benchmark_result = await run_scenario_benchmark(
        scenario_ids=sorted(selected_ids),
    )
    write_benchmark_artifact(
        output_path=artifacts.benchmark_output,
        benchmark_result=benchmark_result,
    )

    experiment_run_rows = build_experiment_run_rows(
        benchmark_result,
        example_id_by_scenario_id=published_dataset.example_id_by_scenario_id,
    )
    write_json(artifacts.experiment_runs_output, experiment_run_rows)

    run_ax_command(
        [
            "ax",
            "experiments",
            "create",
            "--name",
            experiment_name,
            "--dataset",
            published_dataset.name,
            "--space",
            space,
            "--file",
            str(artifacts.experiment_runs_output),
            "-o",
            "json",
        ]
    )

    if annotate_runs:
        ensure_annotation_config(space=space, name="db_correctness")
        exported_runs = export_experiment_runs(
            space=space,
            dataset_name=published_dataset.name,
            experiment_name=experiment_name,
        )
        annotations = build_run_annotations(exported_runs)
        write_json(artifacts.run_annotations_output, annotations)
        run_ax_command(
            [
                "ax",
                "experiments",
                "annotate-runs",
                experiment_name,
                "--dataset",
                published_dataset.name,
                "--space",
                space,
                "--file",
                str(artifacts.run_annotations_output),
            ]
        )

    return PublishSummary(
        dataset_name=published_dataset.name,
        experiment_name=experiment_name,
        accuracy=benchmark_result.accuracy,
        artifacts=artifacts,
    )


def run_ax_command(args: list[str]) -> str:
    """Runs an ax CLI command and returns stdout on success."""
    completed = subprocess.run(args, check=True, capture_output=True, text=True)
    return completed.stdout


def resolve_dataset(
    *,
    space: str,
    dataset_name: str,
    dataset_output: Path,
    scenario_ids: set[int],
) -> PublishedDataset:
    """Creates the dataset if missing, otherwise validates and reuses it."""
    try:
        run_ax_command(
            ["ax", "datasets", "get", dataset_name, "--space", space, "-o", "json"]
        )
    except subprocess.CalledProcessError:
        run_ax_command(
            [
                "ax",
                "datasets",
                "create",
                "--name",
                dataset_name,
                "--space",
                space,
                "--file",
                str(dataset_output),
                "-o",
                "json",
            ]
        )

    exported = json.loads(
        run_ax_command(
            [
                "ax",
                "datasets",
                "export",
                dataset_name,
                "--space",
                space,
                "--stdout",
                "--all",
            ]
        )
    )
    example_id_by_scenario_id: dict[int, str] = {}
    exported_ids: set[int] = set()
    for record in exported:
        properties = record.get("additional_properties", {})
        scenario_id = int(float(properties["scenario_id"]))
        example_id_by_scenario_id[scenario_id] = str(record["id"])
        exported_ids.add(scenario_id)

    if exported_ids != scenario_ids:
        raise RuntimeError(
            "Existing AX dataset does not match the selected local scenarios. "
            f"Local IDs: {sorted(scenario_ids)}. AX IDs: {sorted(exported_ids)}. "
            "Choose a new dataset name or recreate the dataset in AX."
        )

    return PublishedDataset(
        name=dataset_name,
        example_id_by_scenario_id=example_id_by_scenario_id,
    )


def export_experiment_runs(
    *,
    space: str,
    dataset_name: str,
    experiment_name: str,
) -> list[dict[str, Any]]:
    """Exports AX experiment runs for post-processing and annotation."""
    return json.loads(
        run_ax_command(
            [
                "ax",
                "experiments",
                "export",
                experiment_name,
                "--dataset",
                dataset_name,
                "--space",
                space,
                "--stdout",
                "--all",
            ]
        )
    )


def build_run_annotations(experiment_runs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Builds deterministic annotations for AX experiment runs."""
    annotations: list[dict[str, Any]] = []
    for run in experiment_runs:
        properties = run.get("additional_properties", {})
        db_success = bool(properties.get("db_success"))
        label = "correct" if db_success else "incorrect"
        explanation = (
            "Local benchmark verified the expected work-order side effects."
            if db_success
            else "Local benchmark did not match the expected work-order side effects."
        )
        annotations.append(
            {
                "record_id": run["id"],
                "values": [
                    {
                        "name": "db_correctness",
                        "label": label,
                        "text": explanation,
                    }
                ],
            }
        )
    return annotations


def ensure_annotation_config(*, space: str, name: str) -> None:
    """Creates the annotation config used for deterministic run scoring if needed."""
    try:
        run_ax_command(
            ["ax", "annotation-configs", "get", name, "--space", space, "-o", "json"]
        )
    except subprocess.CalledProcessError:
        run_ax_command(
            [
                "ax",
                "annotation-configs",
                "create",
                "--name",
                name,
                "--space",
                space,
                "--type",
                "categorical",
                "--value",
                "correct",
                "--value",
                "incorrect",
                "-o",
                "json",
            ]
        )
