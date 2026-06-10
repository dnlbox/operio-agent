import { getDb } from '../db.js';

export const createWorkOrderSchema = {
  name: 'create_work_order',
  description: 'Create a new maintenance work order ticket in the system.',
  inputSchema: {
    type: 'object',
    properties: {
      tenantId: { type: 'string', description: 'The unique ID of the reporting tenant.' },
      assetId: { type: 'string', description: 'The unique ID of the faulty equipment/asset.' },
      description: { type: 'string', description: 'Detailed description of the problem.' },
      costEstimation: { type: 'number', description: 'Estimated repair cost.' },
      leaseResponsibility: { type: 'string', description: 'Who is liable based on the lease (e.g. Landlord, Tenant).' },
      leaseClauseRef: { type: 'string', description: 'Lease section referenced (e.g. Section 9.1).' },
      emergencyLevel: { type: 'string', enum: ['Routine', 'Urgent', 'Emergency'], description: 'Emergency level of the request.' },
      sessionId: { type: 'string', description: 'Optional. The chat session ID that triggered this work order.' }
    },
    required: ['tenantId', 'assetId', 'description', 'costEstimation', 'leaseResponsibility', 'leaseClauseRef', 'emergencyLevel']
  }
};

export async function createWorkOrder(args: any) {
  const database = await getDb();
  const payload = args as {
    tenantId: string;
    assetId: string;
    description: string;
    costEstimation: number;
    leaseResponsibility: string;
    leaseClauseRef: string;
    emergencyLevel: string;
    sessionId?: string;
  };

  console.error(`[MongoDB MCP] Creating work order for tenant: ${payload.tenantId}`);

  let initialStatus = 'Dispatched';
  let message = 'Work order auto-dispatched.';

  if (payload.emergencyLevel === 'Emergency') {
    initialStatus = 'Dispatched';
    message = 'EMERGENCY BYPASS: Work order auto-dispatched immediately to protect asset integrity.';
  } else if (payload.leaseResponsibility === 'Tenant') {
    initialStatus = 'Dispatched';
    message = 'Tenant Chargeback: Auto-dispatched because costs are responsibility of Tenant.';
  } else if (payload.leaseResponsibility === 'Landlord' && payload.costEstimation > 150) {
    initialStatus = 'Pending Approval';
    message = 'Requires Landlord Approval: Cost exceeds the $150 standard limit.';
  }

  const workOrder = {
    ...payload,
    status: initialStatus,
    assignedTo: null,
    externalSystemPayload: {
      source: 'Operio-Agent',
      externalId: `WO-${Math.floor(100000 + Math.random() * 900000)}`,
      action: initialStatus === 'Dispatched' ? 'CREATE_AND_DISPATCH' : 'CREATE_PENDING_APPROVAL',
      costCenter: payload.leaseResponsibility === 'Tenant' ? 'Tenant-Reimbursable' : 'Common-Area-Maintenance'
    },
    timeline: [
      {
        status: 'Created',
        timestamp: new Date().toISOString()
      }
    ]
  };

  const result = await database.collection('work_orders').insertOne(workOrder);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          wo_id: result.insertedId.toString(),
          status: initialStatus,
          message: message
        })
      }
    ]
  };
}
