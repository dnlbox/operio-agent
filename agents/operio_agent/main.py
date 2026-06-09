"""Main application entry point for the Operio FastAPI backend."""

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from operio_agent.api.deps import limiter
from operio_agent.api.routes import chat, docs, staff, tickets
from operio_agent.config import settings
from operio_agent.core.brain import OperioBrain
from operio_agent.core.mcp_client import McpClientManager
from operio_agent.database.session import (
    create_mongo_client,
    get_mongo_db,
)

ALLOWED_ORIGINS = [
    "https://operio.chat",
    "http://localhost:3001",
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application database clients and MCP servers lifecycle."""
    # 1. Initialize DB clients
    print(f"[Lifespan] Connecting to MongoDB at {settings.mongo_uri}...")
    mongo_client = create_mongo_client()
    db = get_mongo_db(mongo_client)

    # Store on app.state
    app.state.mongo_client = mongo_client
    app.state.db = db

    # 2. Start MCP subprocesses
    mcp_manager = McpClientManager(
        mongo_cmd=settings.mongo_mcp_command,
    )
    try:
        await mcp_manager.start()
        print("[Lifespan] All background MCP servers started successfully.")
    except Exception as e:
        print(f"[Lifespan] Critical failure during MCP startup: {e}")

    app.state.mcp_manager = mcp_manager

    # 3. Instantiate Reasoning Loop Brain
    brain = OperioBrain(mcp_manager)
    app.state.brain = brain

    yield

    # Cleanup: Shutdown MCP processes and close database clients
    print("[Lifespan] Stopping background MCP servers...")
    await mcp_manager.stop()
    print("[Lifespan] Closing MongoDB client connection...")
    mongo_client.close()
    print("[Lifespan] Cleanup complete.")


app = FastAPI(
    title="Operio Agent API Server",
    description="Backend API coordinating the SRE Mall Operations Agent brain.",
    lifespan=lifespan,
)

# --- Rate limiting (slowapi) ---
# limiter is defined in api/deps.py; key_func returns the real client IP
# by reading X-Forwarded-For (Cloud Run / Caddy) with fallback to host.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register Sub-routers
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(tickets.router, prefix="/api", tags=["Tickets"])
app.include_router(staff.router, prefix="/api", tags=["Staff"])
app.include_router(docs.router, prefix="/api", tags=["Documents"])


@app.get("/api/health")
def health_check() -> dict[str, Any]:
    """Validates connectivity to the backing database.

    Returns:
        dict[str, Any]: Health status mapping.
    """
    db = app.state.db

    mongo_ok = False
    mongo_error: str | None = None
    try:
        mongo_ok = db.command("ping")["ok"] == 1.0
    except Exception as exc:  # surface connectivity failures instead of crashing
        mongo_error = f"{type(exc).__name__}: {exc}"

    return {
        "status": "ok" if mongo_ok else "degraded",
        "service": "operio-agent-orchestrator",
        "databases": {
            "mongodb": mongo_ok,
        },
        "mongo_error": mongo_error,
    }


# Serve static files from the demo directory (Frontend interface)
app.mount("/", StaticFiles(directory="demo", html=True), name="demo")

if __name__ == "__main__":
    import uvicorn

    print("[Main] Launching FastAPI Web Server on http://localhost:3001...")
    uvicorn.run("operio_agent.main:app", host="0.0.0.0", port=3001, reload=False)
