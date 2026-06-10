import { runRagSearch } from '../rag.js';
import { getDb } from '../db.js';

export const searchLeasesSchema = {
  name: 'search_leases',
  description: 'Perform keyword search on tenant leases to locate liability, cost rules, and repair boundaries. Enforces tenant data isolation by filtering by leaseId.',
  inputSchema: {
    type: 'object',
    properties: {
      leaseId: {
        type: 'string',
        description: 'The unique lease ID (e.g., lease_nike_104, lease_adidas_105) of the tenant calling RAG.'
      },
      query: {
        type: 'string',
        description: 'The search query relating to liabilities (e.g. HVAC responsibility, storefront windows, repair limits).'
      }
    },
    required: ['leaseId', 'query']
  }
};

export async function searchLeases(args: any) {
  const database = await getDb();
  const { leaseId, query } = args as { leaseId: string; query: string };
  console.error(`[MongoDB MCP] RAG search leases for: "${query}" under lease: "${leaseId}"`);

  const hits = await runRagSearch(database, 'leases', query, 'leaseId', leaseId);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(hits)
      }
    ]
  };
}
