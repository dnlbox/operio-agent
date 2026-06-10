import { getDb } from '../db.js';

export const queryActiveStaffSchema = {
  name: 'query_active_staff',
  description: 'Query active mall technicians/staff filtered by skill and current location/sector.',
  inputSchema: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'The technician skill required (e.g. HVAC, Electrical, Plumbing, Escalator).'
      },
      sector: {
        type: 'string',
        description: 'The mall sector where help is needed (e.g. Sector B).'
      }
    },
    required: ['skill', 'sector']
  }
};

export async function queryActiveStaff(args: any) {
  const database = await getDb();
  const { skill, sector } = args as { skill: string; sector: string };
  console.error(`[MongoDB MCP] Searching staff with skill: ${skill} in ${sector}`);

  const query = {
    skills: { $in: [skill] },
    status: 'Available'
  };
  
  const staffList = await database.collection('staff').find(query).toArray();
  
  // Sort to prioritize current location match
  staffList.sort((a: any, b: any) => {
    if (a.currentLocation === sector && b.currentLocation !== sector) return -1;
    if (a.currentLocation !== sector && b.currentLocation === sector) return 1;
    return 0;
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(staffList)
      }
    ]
  };
}
