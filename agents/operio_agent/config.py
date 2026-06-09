"""Configuration settings for the Operio Agent system."""

from typing import List, Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """System-wide configuration settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    mongo_uri: str = Field(default="mongodb://localhost:27017", alias="MONGO_URI")
    mongo_db: str = Field(default="operio", alias="MONGO_DB")

    phoenix_project_name: str = Field(
        default="operio-agent", alias="PHOENIX_PROJECT_NAME"
    )
    phoenix_collector_endpoint: str = Field(
        default="http://localhost:6006", alias="PHOENIX_COLLECTOR_ENDPOINT"
    )

    arize_api_key: str | None = Field(default=None, alias="ARIZE_API_KEY")
    arize_space_id: str | None = Field(default=None, alias="ARIZE_SPACE_ID")


    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model_name: str = Field(
        default="gemini-2.5-flash", alias="GEMINI_MODEL_NAME"
    )
    reasoning_backend: Literal["legacy", "adk"] = Field(
        default="adk", alias="OPERIO_REASONING_BACKEND"
    )
    google_genai_use_vertexai: bool = Field(
        default=True, alias="GOOGLE_GENAI_USE_VERTEXAI"
    )
    google_cloud_project: str | None = Field(
        default=None, alias="GOOGLE_CLOUD_PROJECT"
    )
    google_cloud_location: str = Field(
        default="us-central1", alias="GOOGLE_CLOUD_LOCATION"
    )

    mongo_mcp_command: List[str] = Field(
        default=["npx", "tsx", "mcp_servers/mongodb-server.ts"],
        alias="MONGO_MCP_COMMAND",
    )
    phoenix_mcp_command: List[str] = Field(
        default=["npx", "-y", "@arizeai/phoenix-mcp"],
        alias="PHOENIX_MCP_COMMAND",
    )

    landlord_autonomous_limit: float = Field(
        default=150.0, alias="LANDLORD_AUTONOMOUS_LIMIT"
    )
    chat_rate_limit_requests: int = Field(
        default=5, alias="CHAT_RATE_LIMIT_REQUESTS"
    )
    chat_rate_limit_window: int = Field(
        default=60, alias="CHAT_RATE_LIMIT_WINDOW"
    )


settings = Settings()
