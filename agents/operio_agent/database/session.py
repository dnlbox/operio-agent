"""Database connection management and initialization helpers."""

from pymongo import MongoClient
from pymongo.database import Database
from operio_agent.config import settings


def create_mongo_client() -> MongoClient:
    """Creates a MongoClient connection instance.

    Returns:
        MongoClient: The configured MongoDB client.
    """
    return MongoClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=20000,
    )


def get_mongo_db(client: MongoClient) -> Database:
    """Retrieves the active database from a MongoClient.

    Args:
        client: The active MongoClient instance.

    Returns:
        Database: The database object.
    """
    return client[settings.mongo_db]
