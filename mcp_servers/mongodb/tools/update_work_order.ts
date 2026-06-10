import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';

export const updateWorkOrderStatusSchema = {
  name: 'update_work_order_status',
  description: 'Update the status and technician assignment of an existing work order ticket.',
  inputSchema: {
    type: 'object',
    properties: {
      wo_id: { type: 'string', description: 'The unique ID of the work order (MongoDB string representation of ObjectId).' },
      status: { type: 'string', description: 'The new status (e.g. Pending Approval, Dispatched, In Progress, Completed).' },
      technician_id: { type: 'string', description: 'Optional. The ID of the technician being assigned.' }
    },
    required: ['wo_id', 'status']
  }
};

export async function updateWorkOrderStatus(args: any) {
  const database = await getDb();
  const { wo_id, status, technician_id } = args as {
    wo_id: string;
    status: string;
    technician_id?: string;
  };

  if (!wo_id || typeof wo_id !== 'string' || wo_id.trim() === '') {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Invalid or missing work order ID (wo_id): ${wo_id}`
        }
      ]
    };
  }

  console.error(`[MongoDB MCP] Updating work order: ${wo_id} to status: ${status}`);

  const updatePayload: any = {
    $set: { status },
    $push: {
      timeline: {
        status,
        timestamp: new Date().toISOString()
      }
    }
  };

  if (technician_id !== undefined) {
    updatePayload.$set.assignedTo = technician_id;
  }

  let filter: any;
  try {
    filter = { _id: new ObjectId(wo_id) };
  } catch (err) {
    // Fallback to string matching if the id format is custom string (e.g. mock test cases)
    filter = { _id: wo_id };
  }

  const result = await database.collection('work_orders').findOneAndUpdate(
    filter,
    updatePayload,
    { returnDocument: 'after' }
  );

  if (!result) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Work order not found: ${wo_id}`
        }
      ]
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          workOrder: result
        })
      }
    ]
  };
}
