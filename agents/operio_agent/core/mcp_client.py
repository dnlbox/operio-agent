"""Multi-server MCP stdio client manager."""

from contextlib import AsyncExitStack
from typing import Any
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from opentelemetry import trace
from opentelemetry.trace import StatusCode

tracer = trace.get_tracer("operio-agent")


class McpClientManager:
    """Manages lifecycle and tool execution of the MongoDB MCP server.

    Runs the server as a stdio subprocess and manages the client session.
    """

    def __init__(
        self,
        mongo_cmd: list[str] | None = None,
    ) -> None:
        """Initialises McpClientManager with server launch command.

        Args:
            mongo_cmd: Command and args list to start MongoDB MCP server.
        """
        from operio_agent.config import settings

        self.mongo_cmd: list[str] = mongo_cmd or settings.mongo_mcp_command
        self.exit_stack: AsyncExitStack = AsyncExitStack()
        self.mongo_session: ClientSession | None = None

    async def start(self) -> None:
        """Launches the MongoDB MCP server and initialises the client session.

        Raises:
            Exception: If launching the MongoDB server subprocess fails.
        """
        import os
        mcp_env = os.environ.copy()
        mongo_params = StdioServerParameters(
            command=self.mongo_cmd[0], args=self.mongo_cmd[1:], env=mcp_env
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
            print("[MCP Client Manager] MongoDB MCP Server initialised.")
        except Exception as e:
            print(f"[MCP Client Manager] Failed to start MongoDB MCP Server: {e}")
            raise e

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
            server_name: The target MCP server (e.g. 'mongodb').
            tool_name: The name of the tool to execute.
            arguments: Dict of parameters expected by the tool.

        Returns:
            str: The output text returned by the tool.

        Raises:
            ValueError: If the server_name is unrecognised.
            RuntimeError: If the server session is not initialised or errors.
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
                else:
                    raise ValueError(f"Unknown MCP server name: {server_name}")

                if not session:
                    raise RuntimeError(
                        f"MCP server '{server_name}' is not running or initialised."
                    )

                response = await session.call_tool(tool_name, arguments)

                if getattr(response, "isError", False):
                    error_msg = (
                        response.content[0].text
                        if response.content
                        else "Unknown error"
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
