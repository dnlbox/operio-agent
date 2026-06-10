# Arize AX Baseline Flow

The scenarios are the benchmark asset. Everything else in this repo should treat them as the source of truth.

## What Changed

The old benchmark path mixed three concerns in one pytest file:

- scenario definitions
- local mocked benchmark execution
- Phoenix-hosted dataset and experiment upload

That made the flow fragile and hard to reuse. The repo now separates those concerns:

- [agents/operio_agent/evals/scenarios.py](/Users/titan/Code/operio-agent/agents/operio_agent/evals/scenarios.py:1) holds the shared scenario corpus
- [agents/operio_agent/evals/baseline.py](/Users/titan/Code/operio-agent/agents/operio_agent/evals/baseline.py:1) derives expected labels and AX dataset rows
- [agents/operio_agent/evals/runner.py](/Users/titan/Code/operio-agent/agents/operio_agent/evals/runner.py:1) runs the local scenario benchmark and produces experiment-ready results
- [agents/tests/evaluate_brain.py](/Users/titan/Code/operio-agent/agents/tests/evaluate_brain.py:1) is now just the regression gate

## New Workflow

### 1. Run the local scenario benchmark

This is the fastest way to confirm the baseline still works locally.

```bash
PYTHONPATH=agents uv run --project agents python agents/scripts/run_scenario_baseline.py
```

That writes:

- [agents/demo/operio_ax_baseline_results.json](/Users/titan/Code/operio-agent/agents/demo/operio_ax_baseline_results.json:1)

### 2. Export the AX dataset artifact

This exports the scenarios plus expected labels in AX-friendly columns.

```bash
PYTHONPATH=agents uv run --project agents python agents/scripts/export_ax_eval_dataset.py
```

That writes:

- [agents/demo/operio_ax_eval_dataset.csv](/Users/titan/Code/operio-agent/agents/demo/operio_ax_eval_dataset.csv:1)

### 3. Publish the baseline to Arize AX

The repo now has an AX publishing script built around the `ax` CLI:

```bash
PYTHONPATH=agents uv run --project agents python agents/scripts/publish_ax_scenario_baseline.py \
  --space operio \
  --dataset-name operio-scenario-baseline \
  --experiment-name operio-scenario-baseline-$(date +%Y%m%d-%H%M%S)
```

What it does:

1. Writes the local dataset CSV artifact.
2. Creates the AX dataset if it does not exist yet.
3. Reuses the dataset if the scenario IDs match exactly.
4. Runs the local benchmark.
5. Creates an AX experiment from those run outputs.
6. Annotates each run with the deterministic `db_correctness` signal unless `--skip-annotations` is passed.

It also writes local artifacts:

- [agents/demo/operio_ax_experiment_runs.json](/Users/titan/Code/operio-agent/agents/demo/operio_ax_experiment_runs.json:1)
- [agents/demo/operio_ax_run_annotations.json](/Users/titan/Code/operio-agent/agents/demo/operio_ax_run_annotations.json:1)

## CLI Setup

Per the current Arize docs, the CLI install command on macOS is:

```bash
uv tool install arize-ax-cli
```

That has already been installed on this machine. The official setup page is:

- [Arize Skills and MCP](https://arize.com/docs/ax/set-up-with-ai-assistants)

## How This Maps To AX

The scenario corpus now maps cleanly into the AX model:

| Repo artifact | AX concept |
| --- | --- |
| `EVAL_SCENARIOS` | Dataset examples |
| `run_scenario_benchmark()` | Local task execution |
| `operio_ax_experiment_runs.json` | Experiment runs file |
| `db_correctness` annotation | Deterministic baseline metric |
| expected labels in dataset columns | Inputs for reusable AX evaluators |

## Recommended Next Step

Once the baseline dataset and experiment are in AX, recreate the six existing judge prompts as AX evaluators and attach them to the uploaded experiment with AX evaluation tasks. The local scenario benchmark should remain the gate for “did the system still behave correctly,” while AX becomes the system of record for comparing outputs and evaluator scores over time.
