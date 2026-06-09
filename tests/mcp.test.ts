import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';

/**
 * Spawns an MCP server process, executes a JSON-RPC request, and returns the response.
 */
function callMcpServer(
  serverPath: string,
  requests: any[]
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const cp = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    const responses: any[] = [];
    let stdoutBuffer = '';

    cp.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      
      // Store the last incomplete line back in the buffer
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().length === 0) continue;
        try {
          const json = JSON.parse(line);
          responses.push(json);
          
          // If we received all expected responses, resolve and kill child
          if (responses.length === requests.length) {
            cp.stdin.end();
            cp.kill();
            resolve(responses);
            return;
          }
        } catch (e) {
          // Ignore parse errors on debug logging or incomplete JSON lines
        }
      }
    });

    let stderrOutput = '';
    cp.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    cp.on('error', (err) => {
      reject(err);
    });

    cp.on('exit', (code) => {
      if (responses.length < requests.length) {
        reject(new Error(`Server exited prematurely with code ${code}. Stderr: ${stderrOutput}`));
      }
    });

    // Write all requests sequentially
    for (const req of requests) {
      cp.stdin.write(JSON.stringify(req) + '\n');
    }
  });
}

describe('MongoDB MCP Server Integration Tests', () => {
  const mongodbServerPath = path.resolve('mcp_servers/mongodb-server.ts');

  test('should list tools successfully', async () => {
    const listReq = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const res = await callMcpServer(mongodbServerPath, [listReq]);
    expect(res[0]).toBeDefined();
    expect(res[0].id).toBe(1);
    expect(res[0].result).toBeDefined();
    expect(res[0].result.tools).toBeDefined();
    
    const toolNames = res[0].result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('query_active_staff');
    expect(toolNames).toContain('create_work_order');
    expect(toolNames).toContain('update_work_order_status');
    expect(toolNames).toContain('check_active_work_orders');
  });

  test('should execute query_active_staff successfully', async () => {
    const callReq = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'query_active_staff',
        arguments: {
          skill: 'HVAC',
          sector: 'Sector B'
        }
      }
    };

    const res = await callMcpServer(mongodbServerPath, [callReq]);
    expect(res[0]).toBeDefined();
    expect(res[0].id).toBe(2);
    expect(res[0].result).toBeDefined();
    expect(res[0].result.content).toBeDefined();
    
    const contentText = res[0].result.content[0].text;
    const staff = JSON.parse(contentText);
    expect(staff.length).toBeGreaterThan(0);
    expect(staff[0].name).toBe('Sarah Connor');
    expect(staff[0].skills).toContain('HVAC');
  });

  test('should execute check_active_work_orders successfully', async () => {
    const callReq = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'check_active_work_orders',
        arguments: {
          tenantId: 'tenant_001'
        }
      }
    };

    const res = await callMcpServer(mongodbServerPath, [callReq]);
    expect(res[0]).toBeDefined();
    expect(res[0].id).toBe(3);
    expect(res[0].result).toBeDefined();
    expect(res[0].result.content).toBeDefined();
    
    const contentText = res[0].result.content[0].text;
    const orders = JSON.parse(contentText);
    expect(Array.isArray(orders)).toBe(true);
  });

  test('should update work order status successfully and validate input', async () => {
    // 1. Create a work order first
    const createReq = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'create_work_order',
        arguments: {
          tenantId: 'tenant_001',
          assetId: 'Carrier Model-50TJ',
          description: 'Storefront Carrier AC blowing warm air',
          costEstimation: 450,
          leaseResponsibility: 'Landlord',
          leaseClauseRef: 'Section 9.1',
          emergencyLevel: 'Routine'
        }
      }
    };
    const resCreate = await callMcpServer(mongodbServerPath, [createReq]);
    const createResult = JSON.parse(resCreate[0].result.content[0].text);
    expect(createResult.success).toBe(true);
    const woId = createResult.wo_id;
    expect(woId).toBeDefined();

    // 2. Update status of the retrieved order
    const updateReq = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'update_work_order_status',
        arguments: {
          wo_id: woId,
          status: 'Completed'
        }
      }
    };
    const resUpdate = await callMcpServer(mongodbServerPath, [updateReq]);
    expect(resUpdate[0].result).toBeDefined();
    const updateResult2 = JSON.parse(resUpdate[0].result.content[0].text);
    expect(updateResult2.success).toBe(true);
    expect(updateResult2.workOrder.status).toBe('Completed');

    // 3. Update status with invalid/missing wo_id
    const invalidReq = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'update_work_order_status',
        arguments: {
          wo_id: '',
          status: 'Completed'
        }
      }
    };
    const resInvalid = await callMcpServer(mongodbServerPath, [invalidReq]);
    expect(resInvalid[0].result).toBeDefined();
    expect(resInvalid[0].result.isError).toBe(true);
    expect(resInvalid[0].result.content[0].text).toContain('Invalid or missing work order ID');
  });
});

describe('MongoDB MCP Server — Atlas Search Tools', () => {
  const mongodbServerPath = path.resolve('mcp_servers/mongodb-server.ts');

  test('search_leases and search_manuals tools are registered', async () => {
    const listReq = {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/list',
      params: {}
    };

    const res = await callMcpServer(mongodbServerPath, [listReq]);
    expect(res[0]).toBeDefined();
    const toolNames = res[0].result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('search_leases');
    expect(toolNames).toContain('search_manuals');
  });
});
