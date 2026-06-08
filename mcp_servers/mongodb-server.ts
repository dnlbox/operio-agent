import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'operio';

// Initialize MongoDB Client
const mongoClient = new MongoClient(MONGO_URI);
let dbConnected = false;

async function getDb() {
  if (!dbConnected) {
    await mongoClient.connect();
    dbConnected = true;
  }
  return mongoClient.db(MONGO_DB);
}

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
    tools: [
      {
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
      },
      {
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
      },
      {
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
      },
      {
        name: 'check_active_work_orders',
        description: 'Check if there are active work orders (Pending Approval, Dispatched, In Progress) for a specific tenant.',
        inputSchema: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', description: 'The unique ID of the tenant.' }
          },
          required: ['tenantId']
        }
      }
    ]
  };
});

// Handle tool execution calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const database = await getDb();

  try {
    if (name === 'check_active_work_orders') {
      const { tenantId } = args as { tenantId: string };
      console.error(`[MongoDB MCP] Checking active work orders for tenant: ${tenantId}`);

      const query = {
        tenantId,
        status: { $in: ['Pending Approval', 'Dispatched', 'In Progress'] }
      };

      const activeOrders = await database.collection('work_orders').find(query).toArray();
      const normalized = activeOrders.map(order => ({
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

    if (name === 'query_active_staff') {
      const { skill, sector } = args as { skill: string; sector: string };
      console.error(`[MongoDB MCP] Searching staff with skill: ${skill} in ${sector}`);

      const query = {
        skills: { $in: [skill] },
        status: 'Available'
      };
      
      const staffList = await database.collection('staff').find(query).toArray();
      
      // Sort to prioritize current location match
      staffList.sort((a, b) => {
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

    if (name === 'create_work_order') {
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

    if (name === 'update_work_order_status') {
      const { wo_id, status, technician_id } = args as {
        wo_id: string;
        status: string;
        technician_id?: string;
      };

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

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    console.error(`[MongoDB MCP Error] Failed executing ${name}:`, error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: error.message || 'Unknown internal database error'
        }
      ]
    };
  }
});

// Start the server using Stdio transport
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[MongoDB MCP Server] Running on stdio transport');
}).catch((error) => {
  console.error('[MongoDB MCP Server] Failed to start:', error);
});
