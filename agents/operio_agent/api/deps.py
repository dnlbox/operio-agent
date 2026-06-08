"""FastAPI route dependency injections."""

from elasticsearch import Elasticsearch
from fastapi import Request
from pymongo.database import Database

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


def get_elastic_client(request: Request) -> Elasticsearch:
    """Retrieves the active Elasticsearch client from the application state.

    Args:
        request: The active FastAPI HTTP request.

    Returns:
        Elasticsearch: The Elasticsearch client.
    """
    return request.app.state.elastic_client


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
