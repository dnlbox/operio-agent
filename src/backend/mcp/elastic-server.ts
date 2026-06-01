import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';

dotenv.config();

const ELASTIC_URI = process.env.ELASTIC_URI || 'http://localhost:9200';

// Initialize Elasticsearch Client
const elasticClient = new ElasticClient({ node: ELASTIC_URI });

// Initialize MCP Server
const server = new Server(
  {
    name: 'operio-elasticsearch-mcp-server',
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
    tools: [
      {
        name: 'search_leases',
        description: 'Perform keyword search on tenant leases to locate liability, cost rules, and repair boundaries.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query relating to liabilities (e.g. HVAC responsibility, storefront windows, repair limits).'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'search_manuals',
        description: 'Search diagnostic guides and troubleshooting manuals for specific equipment models.',
        inputSchema: {
          type: 'object',
          properties: {
            equipment_model: {
              type: 'string',
              description: 'The equipment brand/model model code (e.g. Carrier Model-50TJ, Otis Model-NPE).'
            },
            query: {
              type: 'string',
              description: 'Troubleshooting symptoms, error codes, or procedures (e.g. error code E-04, AC warm air).'
            }
          },
          required: ['equipment_model', 'query']
        }
      }
    ]
  };
});

// Handle tool execution calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'search_leases') {
      const { query } = args as { query: string };
      console.error(`[Elastic MCP] Querying leases index for: "${query}"`);

      const response = await elasticClient.search({
        index: 'leases',
        body: {
          query: {
            multi_match: {
              query,
              fields: ['content', 'title'],
              fuzziness: 'AUTO'
            }
          },
          size: 3
        }
      });

      const hits = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        leaseId: hit._source.leaseId,
        title: hit._source.title,
        content: hit._source.content,
        score: hit._score
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(hits)
          }
        ]
      };
    }

    if (name === 'search_manuals') {
      const { equipment_model, query } = args as { equipment_model: string; query: string };
      console.error(`[Elastic MCP] Querying manuals for model: "${equipment_model}", query: "${query}"`);

      const response = await elasticClient.search({
        index: 'manuals',
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['content', 'title'],
                    fuzziness: 'AUTO'
                  }
                }
              ],
              filter: [
                {
                  match: {
                    equipmentModel: equipment_model
                  }
                }
              ]
            }
          },
          size: 3
        }
      });

      const hits = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        equipmentModel: hit._source.equipmentModel,
        title: hit._source.title,
        content: hit._source.content,
        score: hit._score
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(hits)
          }
        ]
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    console.error(`[Elastic MCP Error] Failed executing ${name}:`, error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: error.message || 'Unknown internal search index error'
        }
      ]
    };
  }
});

// Start the server using Stdio transport
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[Elastic MCP Server] Running on stdio transport');
}).catch((error) => {
  console.error('[Elastic MCP Server] Failed to start:', error);
});
