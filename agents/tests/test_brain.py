"""Unit tests for the Operio Agent core and web layer."""

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from operio_agent.config import settings
from operio_agent.core.brain import (
    OperioBrain,
    active_lease_id,
    active_tenant_id,
)
from operio_agent.core.mcp_client import McpClientManager
from operio_agent.main import app

# 1. Establish direct database connection for test setup/teardown
mongo_client = MongoClient(settings.mongo_uri)
db = mongo_client[settings.mongo_db]

# 2. Populate application state manually for Starlette TestClient (bypassing lifespan)
app.state.mongo_client = mongo_client
app.state.db = db
from elasticsearch import Elasticsearch

app.state.elastic_client = Elasticsearch(settings.elastic_uri)

mcp_manager = McpClientManager()
app.state.mcp_manager = mcp_manager
app.state.brain = OperioBrain(mcp_manager)

client = TestClient(app)


def test_health_endpoint() -> None:
    """Tests the health check API endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "operio-agent-orchestrator"


def test_config_loading() -> None:
    """Verifies that system configuration environment variables are loaded."""
    assert settings.mongo_db == "operio"
    assert settings.landlord_autonomous_limit == 150.0


def test_get_tickets() -> None:
    """Tests fetching active work orders from the database."""
    response = client.get("/api/tickets")
    assert response.status_code == 200
    tickets = response.json()
    assert isinstance(tickets, list)


def test_get_staff() -> None:
    """Tests fetching staff status from the database."""
    response = client.get("/api/staff")
    assert response.status_code == 200
    staff = response.json()
    assert isinstance(staff, list)


def test_ticket_approval_lifecycle() -> None:
    """Verifies the HITL approval and rejection endpoints."""
    # Insert a mock ticket
    mock_ticket = {
        "tenantId": "tenant_001",
        "assetId": "asset_hvac_104",
        "description": "Mock AC Issue",
        "costEstimation": 250.0,
        "leaseResponsibility": "Landlord",
        "leaseClauseRef": "Section 9.1",
        "emergencyLevel": "Routine",
        "status": "Pending Approval",
        "assignedTo": None,
        "timeline": [{"status": "Created"}],
    }

    result = db.work_orders.insert_one(mock_ticket)
    inserted_id = str(result.inserted_id)

    # Test Approve
    approval_payload = {
        "assignedTo": "staff_001",
        "costEstimation": 220.0,
        "managerNotes": "Approved for dispatch",
    }

    response = client.post(
        f"/api/tickets/{inserted_id}/approve", json=approval_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["ticket"]["status"] == "Dispatched"
    assert data["ticket"]["assignedTo"] == "staff_001"
    assert data["ticket"]["costEstimation"] == 220.0

    # Test Reject/Cancel
    response = client.post(f"/api/tickets/{inserted_id}/reject")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["ticket"]["status"] == "Rejected"

    # Clean up
    db.work_orders.delete_one({"_id": result.inserted_id})


@pytest.mark.asyncio
async def test_duplicate_prevention_logic() -> None:
    """Verifies that the brain uses check_active_work_orders and prevents duplicate work order creation."""
    # 1. Clear existing work orders for tenant_001
    db.work_orders.delete_many({"tenantId": "tenant_001"})

    # Set contexts
    active_tenant_id.set("tenant_001")
    active_lease_id.set("lease_nike_104")

    # Instantiate or reuse brain
    brain = app.state.brain

    # Create an active work order in database first
    mock_wo = {
        "tenantId": "tenant_001",
        "assetId": "asset_plumbing_storage_area",
        "description": "Leaking pipe in storage area.",
        "costEstimation": 500.0,
        "leaseResponsibility": "Landlord",
        "leaseClauseRef": "lease_nike_104",
        "emergencyLevel": "Urgent",
        "status": "Dispatched",
        "assignedTo": "staff_002",
    }
    insert_res = db.work_orders.insert_one(mock_wo)
    wo_id = str(insert_res.inserted_id)

    # We mock generate_content to return tool call to check_active_work_orders on turn 1
    # and then response citing the existing work order on turn 2
    turn_idx = [0]

    class MockContentPart:

        def __init__(self, function_call=None, text=None):
            self.function_call = function_call
            self.text = text

    class MockContent:

        def __init__(self, parts):
            self.parts = parts

    class MockCandidate:

        def __init__(self, content):
            self.content = content

    class MockFunctionCall:

        def __init__(self, name, args):
            self.name = name
            self.args = args

    class MockResponse:

        def __init__(self, text="", function_calls=None):
            self.text = text
            self.function_calls = []
            self.candidates = [
                MockCandidate(
                    content=MockContent(parts=[MockContentPart(text=text)])
                )
            ]
            if function_calls:
                self.function_calls = [
                    MockFunctionCall(call["name"], call["args"])
                    for call in function_calls
                ]
                parts = [MockContentPart(function_call=f) for f in self.function_calls]
                self.candidates = [MockCandidate(content=MockContent(parts=parts))]

    def mock_generate_content(model, contents, config=None):
        idx = turn_idx[0]
        turn_idx[0] += 1

        if idx == 0:
            return MockResponse(
                function_calls=[{"name": "check_active_work_orders", "args": {}}]
            )
        else:
            return MockResponse(
                text=(
                    f"A duplicate active work order exists with ID {wo_id} "
                    f"and status Dispatched. No new order created."
                )
            )

    # Save original method
    original_generate = brain.client.models.generate_content
    brain.client.models.generate_content = mock_generate_content

    try:
        # Run reasoning loop
        history = [
            {"role": "user", "content": "I see a pipe leaking close to products."}
        ]
        result = await brain.run_reasoning_loop(history, "Outdoor Temp: 20°C")

        # Assertions
        assert (
            "duplicate" in result["response_text"] or wo_id in result["response_text"]
        )
        # Verify no new work order was created (count should still be 1)
        count = db.work_orders.count_documents({"tenantId": "tenant_001"})
        assert count == 1
    finally:
        # Restore method and clean up
        brain.client.models.generate_content = original_generate
        db.work_orders.delete_many({"tenantId": "tenant_001"})
