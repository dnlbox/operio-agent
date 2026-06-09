"""FastAPI route dependency injections."""

from fastapi import Request
from pymongo.database import Database
from slowapi import Limiter

from operio_agent.core.brain import OperioBrain
from operio_agent.core.mcp_client import McpClientManager

# X-Forwarded-For is set by Cloud Run / Caddy.
# The real client IP is the first (leftmost) entry in that header;
# fall back to request.client.host when the header is absent (local dev).
_FORWARDED_FOR_HEADER = "X-Forwarded-For"


def client_ip_key(request: Request) -> str:
    """Returns the real client IP for rate-limit bucketing.

    Behind Cloud Run the proxy appends the originating IP as the first entry
    of the X-Forwarded-For header.  We read that value rather than
    request.client.host, which would be the proxy's address.

    Args:
        request: The active FastAPI HTTP request.

    Returns:
        str: The originating client IP address.
    """
    forwarded_for = request.headers.get(_FORWARDED_FOR_HEADER, "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


# Module-level limiter wired to the client_ip_key function.
# app.state.limiter and SlowAPIMiddleware are registered in main.py.
limiter = Limiter(key_func=client_ip_key)


def get_db(request: Request) -> Database:
    """Retrieves the active MongoDB database connection from the application state.

    Args:
        request: The active FastAPI HTTP request.

    Returns:
        Database: The Mongo database object.
    """
    return request.app.state.db


def get_mcp_manager(request: Request) -> McpClientManager:
    """Retrieves the active MCP client manager from the application state.

    Args:
        request: The active FastAPI HTTP request.

    Returns:
        McpClientManager: The MCP client manager.
    """
    return request.app.state.mcp_manager


def get_brain(request: Request) -> OperioBrain:
    """Retrieves the active OperioBrain instance from the application state.

    Args:
        request: The active FastAPI HTTP request.

    Returns:
        OperioBrain: The Operio reasoning brain.
    """
    return request.app.state.brain
