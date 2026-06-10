import { searchLeasesSchema, searchLeases } from './search_leases.js';
import { searchManualsSchema, searchManuals } from './search_manuals.js';
import { queryActiveStaffSchema, queryActiveStaff } from './query_active_staff.js';
import { createWorkOrderSchema, createWorkOrder } from './create_work_order.js';
import { updateWorkOrderStatusSchema, updateWorkOrderStatus } from './update_work_order.js';
import { checkActiveWorkOrdersSchema, checkActiveWorkOrders } from './check_active_work_orders.js';

export const toolSchemas = [
  searchLeasesSchema,
  searchManualsSchema,
  queryActiveStaffSchema,
  createWorkOrderSchema,
  updateWorkOrderStatusSchema,
  checkActiveWorkOrdersSchema
];

export async function handleToolCall(name: string, args: any) {
  try {
    switch (name) {
      case 'search_leases':
        return await searchLeases(args);
      case 'search_manuals':
        return await searchManuals(args);
      case 'query_active_staff':
        return await queryActiveStaff(args);
      case 'create_work_order':
        return await createWorkOrder(args);
      case 'update_work_order_status':
        return await updateWorkOrderStatus(args);
      case 'check_active_work_orders':
        return await checkActiveWorkOrders(args);
      default:
        throw new Error(`Tool not found: ${name}`);
    }
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
}
