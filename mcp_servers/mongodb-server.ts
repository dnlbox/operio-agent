import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toolSchemas, handleToolCall } from './mongodb/tools/index.js';

// Initialize MCP Server
const server = new Server(
  {
    name: 'operio-mongodb-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list of tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolSchemas
  };
});

// Handle tool execution calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args);
});

// Start the server using Stdio transport
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[MongoDB MCP Server] Running on stdio transport');
}).catch((error) => {
  console.error('[MongoDB MCP Server] Failed to start:', error);
});
