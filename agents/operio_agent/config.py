"""Configuration settings for the Operio Agent system."""

from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """System-wide configuration settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    mongo_uri: str = Field(default="mongodb://localhost:27017", alias="MONGO_URI")
    mongo_db: str = Field(default="operio", alias="MONGO_DB")
    elastic_uri: str = Field(default="http://localhost:9200", alias="ELASTIC_URI")

    phoenix_project_name: str = Field(
        default="operio-agent", alias="PHOENIX_PROJECT_NAME"
    )
    phoenix_collector_endpoint: str = Field(
        default="http://localhost:6006", alias="PHOENIX_COLLECTOR_ENDPOINT"
    )

    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model_name: str = Field(
        default="gemini-2.5-flash", alias="GEMINI_MODEL_NAME"
    )

    mongo_mcp_command: List[str] = Field(
        default=["npx", "tsx", "mcp_servers/mongodb-server.ts"],
        alias="MONGO_MCP_COMMAND",
    )
    elastic_mcp_command: List[str] = Field(
        default=["npx", "tsx", "mcp_servers/elastic-server.ts"],
        alias="ELASTIC_MCP_COMMAND",
    )

    landlord_autonomous_limit: float = Field(
        default=150.0, alias="LANDLORD_AUTONOMOUS_LIMIT"
    )


settings = Settings()
