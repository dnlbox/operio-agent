"""Tests for full-source lease and manual document loading."""

from operio_agent.api.routes.docs import load_source_document


def test_load_source_document_returns_full_lease_markdown() -> None:
    """Loads a lease source file and returns the expected document metadata."""
    document = load_source_document("leases", lease_id="lease_adidas_105")

    assert document["type"] == "leases"
    assert document["leaseId"] == "lease_adidas_105"
    assert document["title"] == "LEASE AGREEMENT — ADIDAS STORE (UNIT 105)"
    assert "Section 11.1 - Heating, Ventilation, and Air Conditioning (HVAC)" in document["content"]
    assert document["pdfUrl"] == "/assets/leases/lease_adidas_105.pdf"


def test_load_source_document_returns_full_manual_markdown() -> None:
    """Loads a manual source file and returns the expected document metadata."""
    document = load_source_document("manuals", equipment_model="Honeywell Model-T6")

    assert document["type"] == "manuals"
    assert document["equipmentModel"] == "Honeywell Model-T6"
    assert document["title"] == "Honeywell Thermostat T6 Pro Manual"
    assert "Battery Replacement & Calibration" in document["content"]
    assert document["pdfUrl"] == "/assets/manuals/honeywell-thermostat.pdf"
