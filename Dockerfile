# ==========================================
# STAGE 1: Build Frontend SPA
# ==========================================
FROM node:22-slim AS frontend-builder
WORKDIR /build

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo configuration and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY frontend/package.json ./frontend/

# Install Node dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source and build it
COPY frontend/ ./frontend/
RUN pnpm --filter operio-frontend build

# ==========================================
# STAGE 2: Python + Node.js Production Runtime
# ==========================================
FROM python:3.11-slim AS runtime
WORKDIR /app

# Install Node.js, npm, pnpm (needed to run TS MCP servers at runtime)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv for fast python package installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY agents/pyproject.toml agents/uv.lock ./agents/

# Install node dependencies (including tsx for running TS MCP servers)
RUN pnpm install --frozen-lockfile

# Install Python dependencies system-wide
RUN uv pip install --system -r agents/pyproject.toml

# Copy built frontend assets from STAGE 1
COPY --from=frontend-builder /build/demo ./demo

# Copy application code
COPY mcp_servers/ ./mcp_servers/
COPY agents/ ./agents/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Expose FastAPI port
EXPOSE 3001

# Run FastAPI backend
ENV PYTHONPATH=/app/agents
CMD ["uvicorn", "operio_agent.main:app", "--host", "0.0.0.0", "--port", "3001"]
