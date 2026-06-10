import { getDb } from '../db.js';

export const checkActiveWorkOrdersSchema = {
  name: 'check_active_work_orders',
  description: 'Check if there are active work orders (Pending Approval, Dispatched, In Progress) for a specific tenant.',
  inputSchema: {
    type: 'object',
    properties: {
      tenantId: { type: 'string', description: 'The unique ID of the tenant.' }
    },
    required: ['tenantId']
  }
};

export async function checkActiveWorkOrders(args: any) {
  const database = await getDb();
  const { tenantId } = args as { tenantId: string };
  console.error(`[MongoDB MCP] Checking active work orders for tenant: ${tenantId}`);

  const query = {
    tenantId,
    status: { $in: ['Pending Approval', 'Dispatched', 'In Progress'] }
  };

  const activeOrders = await database.collection('work_orders').find(query).toArray();
  const normalized = activeOrders.map((order: any) => ({
    ...order,
    _id: order._id.toString()
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(normalized)
      }
    ]
  };
}
