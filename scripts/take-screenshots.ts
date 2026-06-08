import { chromium } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'operio';
const APP_URL = 'http://localhost:3001';

async function seedPendingTicket() {
  console.log('Connecting to MongoDB to check/seed a pending HITL work order...');
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(MONGO_DB);
    const existingPending = await db.collection('work_orders').findOne({ status: 'Pending Approval' });
    
    if (!existingPending) {
      console.log('No pending ticket found. Seeding a mock pending HITL work order...');
      await db.collection('work_orders').insertOne({
        tenantId: 'tenant_001',
        assetId: 'Carrier Model-50TJ',
        description: 'Storefront AC temperature fluctuation (Landlord Responsibility)',
        costEstimation: 250,
        leaseResponsibility: 'Landlord',
        leaseClauseRef: 'Section 9.1',
        emergencyLevel: 'Routine',
        status: 'Pending Approval',
        assignedTo: 'staff_001',
        sessionId: 'session_hvac_nike',
        externalSystemPayload: {
          source: 'Operio-Agent',
          externalId: 'WO-109482',
          action: 'CREATE_AND_DISPATCH',
          costCenter: 'Common-Area-Maintenance'
        },
        timeline: [
          {
            status: 'Created',
            timestamp: new Date().toISOString()
          }
        ]
      });
      console.log('Pending HITL ticket seeded.');
    } else {
      console.log('Existing pending ticket found.');
    }
  } catch (err) {
    console.error('Failed to seed pending ticket:', err);
  } finally {
    await client.close();
  }
}

async function waitOnServer(url: string, timeoutMs: number = 20000): Promise<boolean> {
  const start = Date.now();
  console.log(`Waiting for server to become responsive at ${url}...`);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        console.log('Server is online and healthy!');
        return true;
      }
    } catch (e) {
      // Ignore connection errors
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // Ensure screenshot output directory exists
  const screenshotsDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`Created screenshots directory: ${screenshotsDir}`);
  }

  // 1. Seed pending ticket
  await seedPendingTicket();

  // 2. Start backend server
  console.log('Starting backend FastAPI server...');
  const serverProcess: ChildProcess = spawn('pnpm', ['run', 'dev'], {
    shell: true,
    stdio: 'ignore', // Prevent stdout pollution
    detached: true   // Allows killing process tree if needed
  });

  // Handle process termination cleanly
  const cleanup = () => {
    console.log('Shutting down backend FastAPI server...');
    if (serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid); // Kill process group
      } catch (e) {
        serverProcess.kill();
      }
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    const isOnline = await waitOnServer(APP_URL);
    if (!isOnline) {
      throw new Error('Timeout waiting for FastAPI server to start. Check if databases are running.');
    }

    // 3. Launch browser
    console.log('Launching Playwright Chromium browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER PAGEERROR:', err.message));

    // --- SCREENSHOT 1: Dashboard / Command Center ---
    console.log('Capturing Dashboard screenshot...');
    await page.goto(`${APP_URL}/#dashboard`);
    // Wait for the ticket card to be rendered (implies ticket list is loaded)
    await page.waitForSelector('.ticket-row', { timeout: 10000 });
    // Add brief delay for animations to finish
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard.png') });
    console.log('Dashboard screenshot saved.');

    // --- SCREENSHOT 2: Human-in-the-Loop Overlay ---
    console.log('Capturing HITL Overlay screenshot...');
    // Click the "Review Approval" button
    const reviewBtn = page.locator('.btn-action-hitl').first();
    await reviewBtn.click();
    await page.waitForSelector('dialog#hitl-overlay[open]', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, 'hitl_overlay.png') });
    console.log('HITL Overlay screenshot saved.');

    // Close the dialog using escape or clicking close btn
    await page.click('#btn-close-dialog');
    await page.waitForSelector('dialog#hitl-overlay', { state: 'hidden', timeout: 5000 });

    // --- SCREENSHOT 3: Tenant Hub (Chat & Timeline) ---
    console.log('Capturing Tenant Hub screenshot...');
    await page.goto(`${APP_URL}/#tenanthub`);
    await page.waitForSelector('#chat-input-field', { timeout: 5000 });
    
    // Type and send a message to trigger the real LLM agent reasoning loop
    console.log('Sending message to trigger reasoning loop...');
    await page.fill('#chat-input-field', 'The storefront AC is blowing warm air! Need assistance.');
    await page.click('#btn-send-message');
    
    // Wait for the agent to finish thinking and output a response (which removes the loader)
    console.log('Waiting for Gemini agent response and MCP timeline nodes...');
    await page.waitForSelector('.timeline-node', { timeout: 15000 });
    await page.waitForTimeout(2000); // Give it a second to finish any rendering transitions
    await page.screenshot({ path: path.join(screenshotsDir, 'tenant_hub.png') });
    console.log('Tenant Hub screenshot saved.');

    // --- SCREENSHOT 4: RAG Knowledge Inspector ---
    console.log('Capturing RAG Explorer screenshot...');
    await page.goto(`${APP_URL}/#knowledge`);
    await page.waitForSelector('#rag-search-input', { timeout: 5000 });
    await page.fill('#rag-search-input', 'HVAC liability repair cost limit');
    await page.click('#btn-run-rag');
    
    // Wait for RAG results to render (which removes the empty state and shows results)
    await page.waitForSelector('.rag-hit', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, 'rag_explorer.png') });
    console.log('RAG Explorer screenshot saved.');

    // --- SCREENSHOT 5: Certified Staff Portal ---
    console.log('Capturing Staff Portal screenshot...');
    await page.goto(`${APP_URL}/#staff`);
    await page.waitForSelector('.staff-portal-card', { timeout: 10000 });
    
    // Click on the first technician profile to display their details
    await page.click('.staff-portal-card');
    await page.waitForSelector('#portal-detail-panel .detail-section-header', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, 'staff_management.png') });
    console.log('Staff Portal screenshot saved.');

    // Cleanup Playwright resources
    await browser.close();
    console.log('Browser closed.');

  } catch (err) {
    console.error('An error occurred during screenshot generation:', err);
  } finally {
    cleanup();
    process.exit(0);
  }
}

main();
