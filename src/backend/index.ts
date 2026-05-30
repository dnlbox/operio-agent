import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const app = new Hono();

/**
 * Health check endpoint for verifying the server status.
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'operio-agent-orchestrator'
  });
});

/**
 * Serve static files from the frontend directory.
 * Evaluated after API routes.
 */
app.use('/*', serveStatic({ root: './src/frontend' }));

const port = 3001;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});
