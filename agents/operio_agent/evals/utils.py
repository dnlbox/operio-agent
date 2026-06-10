"""Small shared helpers for scenario benchmark CLI entrypoints."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def parse_scenario_ids(raw_value: str) -> list[int]:
    """Parses comma-separated scenario IDs into integers."""
    return [
        int(value.strip())
        for value in raw_value.split(",")
        if value.strip().isdigit()
    ]


def write_json(path: Path, payload: Any) -> None:
    """Writes a JSON payload to disk with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
