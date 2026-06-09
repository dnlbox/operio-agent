"""FastAPI route dependency injections."""

import time
from collections import defaultdict
from fastapi import Request, HTTPException, status
from pymongo.database import Database

from operio_agent.config import settings
from operio_agent.core.brain import OperioBrain
from operio_agent.core.mcp_client import McpClientManager


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


class InMemoryRateLimiter:
    """Sliding-window IP-based rate limiter to prevent API abuse."""

    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.history: dict[str, list[float]] = defaultdict(list)

    def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()

        # Clean history for this IP
        self.history[client_ip] = [
            t for t in self.history[client_ip]
            if now - t < self.window_seconds
        ]

        if len(self.history[client_ip]) >= self.requests_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait before sending another message."
            )

        self.history[client_ip].append(now)


# Global rate limiter dependency initialized from application settings
chat_rate_limiter = InMemoryRateLimiter(
    requests_limit=settings.chat_rate_limit_requests,
    window_seconds=settings.chat_rate_limit_window,
)

