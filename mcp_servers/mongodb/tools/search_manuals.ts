import { runRagSearch } from '../rag.js';
import { getDb } from '../db.js';

export const searchManualsSchema = {
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
};

export async function searchManuals(args: any) {
  const database = await getDb();
  const { equipment_model, query } = args as { equipment_model: string; query: string };
  console.error(`[MongoDB MCP] RAG search manuals for model: "${equipment_model}", query: "${query}"`);

  const hits = await runRagSearch(database, 'manuals', query, 'equipmentModel', equipment_model);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(hits)
      }
    ]
  };
}
