"""Multi-server MCP stdio client manager."""

import asyncio
from contextlib import AsyncExitStack
from typing import Any
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from opentelemetry import trace
from opentelemetry.trace import StatusCode

tracer = trace.get_tracer("operio-agent")


class McpClientManager:
    """Manages lifecycle and tool execution of MongoDB and Elasticsearch MCP servers.

    Runs servers as stdio subprocesses and manages client sessions.
    """

    def __init__(
        self,
        mongo_cmd: list[str] | None = None,
        elastic_cmd: list[str] | None = None,
        phoenix_cmd: list[str] | None = None,
    ) -> None:
        """Initializes McpClientManager with server launch commands.

        Args:
            mongo_cmd: Command and args list to start MongoDB MCP server.
            elastic_cmd: Command and args list to start Elasticsearch MCP server.
            phoenix_cmd: Command and args list to start Arize Phoenix MCP server.
        """
        from operio_agent.config import settings

        self.mongo_cmd: list[str] = mongo_cmd or settings.mongo_mcp_command
        self.elastic_cmd: list[str] = elastic_cmd or settings.elastic_mcp_command
        self.phoenix_cmd: list[str] = phoenix_cmd or settings.phoenix_mcp_command
        self.exit_stack: AsyncExitStack = AsyncExitStack()
        self.mongo_session: ClientSession | None = None
        self.elastic_session: ClientSession | None = None
        self.phoenix_session: ClientSession | None = None

    async def start(self) -> None:
        """Launches all three MCP servers and initializes client sessions.

        Raises:
            Exception: If launching any server subprocess fails.
        """
        import os
        mongo_params = StdioServerParameters(
            command=self.mongo_cmd[0], args=self.mongo_cmd[1:], env=None
        )

        elastic_params = StdioServerParameters(
            command=self.elastic_cmd[0], args=self.elastic_cmd[1:], env=None
        )

        from operio_agent.config import settings
        phoenix_env = os.environ.copy()
        # Set PHOENIX_BASE_URL for the Phoenix MCP server
        if settings.arize_api_key and settings.arize_space_id:
            phoenix_env["PHOENIX_BASE_URL"] = f"https://app.phoenix.arize.com/s/{settings.arize_space_id}"
            phoenix_env["PHOENIX_API_KEY"] = settings.arize_api_key
        else:
            phoenix_env["PHOENIX_BASE_URL"] = settings.phoenix_collector_endpoint
        phoenix_params = StdioServerParameters(
            command=self.phoenix_cmd[0], args=self.phoenix_cmd[1:], env=phoenix_env
        )


        try:
            print("[MCP Client Manager] Starting MongoDB MCP Server...")
            mongo_read_write = await self.exit_stack.enter_async_context(
                stdio_client(mongo_params)
            )
            self.mongo_session = await self.exit_stack.enter_async_context(
                ClientSession(mongo_read_write[0], mongo_read_write[1])
            )
            await self.mongo_session.initialize()
            print("[MCP Client Manager] MongoDB MCP Server initialized.")
        except Exception as e:
            print(f"[MCP Client Manager] Failed to start MongoDB MCP Server: {e}")
            raise e

        try:
            print("[MCP Client Manager] Starting Elasticsearch MCP Server...")
            elastic_read_write = await self.exit_stack.enter_async_context(
                stdio_client(elastic_params)
            )
            self.elastic_session = await self.exit_stack.enter_async_context(
                ClientSession(elastic_read_write[0], elastic_read_write[1])
            )
            await self.elastic_session.initialize()
            print("[MCP Client Manager] Elasticsearch MCP Server initialized.")
        except Exception as e:
            print(f"[MCP Client Manager] Failed to start Elasticsearch MCP Server: {e}")
            raise e

        try:
            print("[MCP Client Manager] Starting Arize Phoenix MCP Server...")
            phoenix_read_write = await self.exit_stack.enter_async_context(
                stdio_client(phoenix_params)
            )
            self.phoenix_session = await self.exit_stack.enter_async_context(
                ClientSession(phoenix_read_write[0], phoenix_read_write[1])
            )
            await self.phoenix_session.initialize()
            print("[MCP Client Manager] Arize Phoenix MCP Server initialized.")
        except Exception as e:
            print(f"[MCP Client Manager] Failed to start Arize Phoenix MCP Server (continuing without it): {e}")

    async def stop(self) -> None:
        """Cleans up and terminates all subprocesses via AsyncExitStack."""
        print("[MCP Client Manager] Terminating MCP servers and closing pipes...")
        await self.exit_stack.aclose()
        print("[MCP Client Manager] MCP servers stopped.")

    async def call_tool(
        self, server_name: str, tool_name: str, arguments: dict[str, Any]
    ) -> str:
        """Calls a tool on a specified MCP server.

        Wrapped in an OpenTelemetry span for tracing visibility in Arize Phoenix.

        Args:
            server_name: The target MCP server (e.g. 'mongodb', 'elasticsearch').
            tool_name: The name of the tool to execute.
            arguments: Dict of parameters expected by the tool.

        Returns:
            str: The output text returned by the tool.

        Raises:
            ValueError: If the server_name is unrecognized.
            RuntimeError: If the server session is not initialized or errors.
        """
        with tracer.start_as_current_span(
            name=f"mcp_tool_execution:{server_name}.{tool_name}",
            kind=trace.SpanKind.CLIENT,
        ) as span:
            span.set_attribute("mcp.server", server_name)
            span.set_attribute("mcp.tool", tool_name)
            span.set_attribute("mcp.arguments", str(arguments))

            try:
                if server_name == "mongodb":
                    session = self.mongo_session
                elif server_name == "elasticsearch":
                    session = self.elastic_session
                elif server_name == "phoenix":
                    session = self.phoenix_session
                else:
                    raise ValueError(f"Unknown MCP server name: {server_name}")

                if not session:
                    raise RuntimeError(
                        f"MCP server '{server_name}' is not running or initialized."
                    )

                response = await session.call_tool(tool_name, arguments)

                # Check for error in response
                if getattr(response, "isError", False):
                    error_msg = (
                        response.content[0].text if response.content else "Unknown error"
                    )
                    raise RuntimeError(
                        f"MCP Server Error [{server_name}.{tool_name}]: {error_msg}"
                    )

                output_text = response.content[0].text if response.content else ""
                span.set_attribute("mcp.success", True)
                return output_text
            except Exception as e:
                span.record_exception(e)
                span.set_status(StatusCode.ERROR, str(e))
                raise e
