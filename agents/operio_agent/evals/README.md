# Eval Package

This package separates three concerns that used to be mixed together:

1. `scenarios.py`
   The shared scenario corpus. This is the benchmark source of truth.
2. `baseline.py` and `runner.py`
   Pure expectation derivation plus the deterministic local benchmark runner.
3. `ax_publish.py`
   Arize AX dataset, experiment, and annotation publishing helpers.
4. `live_trace.py`
   Live chat-turn evaluators that score traced spans and log the results back to Phoenix.

Scripts under `agents/scripts/` are intentionally thin entrypoints. Package code owns the real logic so the benchmark can be reused by tests, local commands, and later CI automation without duplicating behavior.
