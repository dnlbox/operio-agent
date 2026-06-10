# Arize Judge Guide

This is the fastest path for a hackathon judge to validate that Operio is using Arize meaningfully instead of treating observability as a screenshot-only add-on.

## What To Open

1. Start the app and local Phoenix instance:

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm run seed
pnpm run dev
```

2. Open:
   - App: [http://localhost:3001](http://localhost:3001)
   - Arize Phoenix: [http://localhost:6006](http://localhost:6006)

## What Judges Should Verify

### 1. Live reasoning is fully traceable

Run one of these prompts in the app:

- "Our AC stopped working and the store is getting hot."
- "The compressor replacement quote is above the lease threshold. What happens next?"
- "Our custom display lighting keeps flickering even after bulb replacement."

Then open the latest Phoenix trace and confirm that it includes:

- a `session.id` for conversation continuity
- tool spans for lease search, manual search, and staff/work-order actions
- the final operational outcome such as `auto_dispatched`, `pending_approval`, or `guidance_only`
- evaluation metadata attached to the traced turn

### 2. The agent uses evidence before acting

Within the same trace, judges should be able to see that the answer was not produced in isolation:

- lease retrieval happens before liability or approval decisions
- manual retrieval appears when diagnostics are needed
- MongoDB-backed work-order actions happen only after reasoning is complete

### 3. The agent chooses the right workflow

Use the prompt contrast below:

- Routine tenant-liable HVAC issue: should auto-dispatch.
- Landlord-liable high-cost repair: should stop in `pending_approval`.
- Policy or event question: should return guidance without creating a work order.

This contrast is the clearest proof that the system is reasoning over workflow state, not just generating generic chat answers.

## Optional AX Validation

If judges want to inspect reusable evaluation assets in Arize AX, run:

```bash
pnpm run eval:flow -- --publish --space operio
```

This publishes the shared scenario baseline as:

- an AX dataset
- an AX experiment
- deterministic run annotations for baseline comparison

AX publishing is optional for the local product demo. The primary live proof point is the Phoenix trace tree at `http://localhost:6006`.

## Recommended Demo Order

1. Run a routine HVAC issue and show the auto-dispatch path in Phoenix.
2. Run a high-cost landlord-liable issue and show the approval gate.
3. Run an ambiguous diagnostics case and show that the agent retrieved evidence before deciding.
4. Optionally show the AX-published baseline to demonstrate repeatable evaluation beyond the live trace.
