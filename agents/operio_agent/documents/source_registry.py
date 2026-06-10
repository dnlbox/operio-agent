"""Shared registry for full-source lease and manual document assets."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SOURCE_ROOT = REPO_ROOT / "docs" / "mock_data"

LEASE_SOURCE_FILES: dict[str, dict[str, str]] = {
    "lease_nike_104": {
        "file": "leases/nike-lease.md",
        "pdfUrl": "/assets/leases/lease_nike_104.pdf",
    },
    "lease_adidas_105": {
        "file": "leases/adidas-lease.md",
        "pdfUrl": "/assets/leases/lease_adidas_105.pdf",
    },
    "lease_zara_106": {
        "file": "leases/zara-lease.md",
        "pdfUrl": "/assets/leases/lease_zara_106.pdf",
    },
    "lease_puma_107": {
        "file": "leases/puma-lease.md",
        "pdfUrl": "/assets/leases/lease_puma_107.pdf",
    },
    "lease_apple_108": {
        "file": "leases/apple-lease.md",
        "pdfUrl": "/assets/leases/lease_apple_108.pdf",
    },
}

MANUAL_SOURCE_FILES: dict[str, dict[str, str]] = {
    "Carrier Model-50TJ": {
        "file": "manuals/carrier-hvac.md",
        "pdfUrl": "/assets/manuals/carrier-hvac.pdf",
    },
    "Otis Model-NPE": {
        "file": "manuals/otis-escalator.md",
        "pdfUrl": "/assets/manuals/otis-escalator.pdf",
    },
    "Schindler Model-9300": {
        "file": "manuals/schindler-elevator.md",
        "pdfUrl": "/assets/manuals/schindler-elevator.pdf",
    },
    "Rheem Model-Classic": {
        "file": "manuals/rheem-hvac.md",
        "pdfUrl": "/assets/manuals/rheem-hvac.pdf",
    },
    "Honeywell Model-T6": {
        "file": "manuals/honeywell-thermostat.md",
        "pdfUrl": "/assets/manuals/honeywell-thermostat.pdf",
    },
    "McQuay Model-WSC": {
        "file": "manuals/mcquay-chiller.md",
        "pdfUrl": "/assets/manuals/mcquay-chiller.pdf",
    },
    "Culligan Model-HE": {
        "file": "manuals/culligan-softener.md",
        "pdfUrl": "/assets/manuals/culligan-softener.pdf",
    },
    "Lutron Model-Quantum": {
        "file": "manuals/lutron-lighting.md",
        "pdfUrl": "/assets/manuals/lutron-lighting.pdf",
    },
    "Kone Model-TravelMaster": {
        "file": "manuals/kone-escalator.md",
        "pdfUrl": "/assets/manuals/kone-escalator.pdf",
    },
    "Generac Model-Protector": {
        "file": "manuals/generac-generator.md",
        "pdfUrl": "/assets/manuals/generac-generator.pdf",
    },
}
