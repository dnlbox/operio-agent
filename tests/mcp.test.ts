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
  const mongodbServerPath = path.resolve('src/backend/mcp/mongodb-server.ts');

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
});

describe('Elasticsearch MCP Server Integration Tests', () => {
  const elasticServerPath = path.resolve('src/backend/mcp/elastic-server.ts');

  test('should list tools successfully', async () => {
    const listReq = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const res = await callMcpServer(elasticServerPath, [listReq]);
    expect(res[0]).toBeDefined();
    expect(res[0].id).toBe(1);
    const toolNames = res[0].result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('search_leases');
    expect(toolNames).toContain('search_manuals');
  });

  test('should execute search_leases successfully', async () => {
    const callReq = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_leases',
        arguments: {
          query: 'HVAC liability'
        }
      }
    };

    const res = await callMcpServer(elasticServerPath, [callReq]);
    expect(res[0]).toBeDefined();
    expect(res[0].id).toBe(2);
    
    const contentText = res[0].result.content[0].text;
    const hits = JSON.parse(contentText);
    expect(hits.length).toBeGreaterThan(0);
    
    // Check if Nike lease Section 9.1 is returned (since we search HVAC)
    const nikeHits = hits.filter((h: any) => h.leaseId === 'lease_nike_104');
    expect(nikeHits.length).toBeGreaterThan(0);
    expect(nikeHits[0].content).toContain('Section 9.1');
  });
});
