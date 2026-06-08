import { z } from 'zod';

/**
 * Zod schema for a work order ticket timeline event.
 */
export const ticketTimelineEventSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  notes: z.string().optional(),
});

/**
 * Zod schema for external system payload integration details.
 */
export const externalSystemPayloadSchema = z.object({
  source: z.string(),
  externalId: z.string(),
  action: z.string(),
  costCenter: z.string(),
});

/**
 * Zod schema validating a CMMS work order ticket.
 */
export const ticketSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  assetId: z.string(),
  description: z.string(),
  status: z.enum(['Pending Approval', 'Dispatched', 'Rejected', 'Created']),
  assignedTo: z.string().nullable(),
  costEstimation: z.number(),
  leaseResponsibility: z.enum(['Tenant', 'Landlord', 'Unknown']),
  leaseClauseRef: z.string().nullable(),
  emergencyLevel: z.enum(['Routine', 'Urgent', 'Emergency']),
  externalSystemPayload: externalSystemPayloadSchema.optional(),
  timeline: z.array(ticketTimelineEventSchema),
  sessionId: z.string().optional(),
});

/**
 * Zod schema validating an on-site technician staff member.
 */
export const staffSchema = z.object({
  _id: z.string(),
  name: z.string(),
  skills: z.array(z.string()),
  status: z.enum(['Available', 'Busy', 'Offline']),
  currentLocation: z.string(),
  shiftStart: z.string(),
  shiftEnd: z.string(),
  ratePerHour: z.number(),
});

/**
 * Zod schema validating a single chat message record.
 */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'model', 'system']),
  content: z.string(),
});

/**
 * Zod schema validating a timeline trace step of LLM reasoning.
 */
export const timelineStepSchema = z.object({
  type: z.enum(['thought', 'tool_call', 'tool_result', 'response', 'warning']),
  title: z.string(),
  details: z.string(),
});

/**
 * Zod schema validating a document search result (RAG hit).
 */
export const ragHitSchema = z.object({
  id: z.string(),
  type: z.enum(['leases', 'manuals']),
  title: z.string(),
  content: z.string(),
  pdfUrl: z.string().optional(),
  leaseId: z.string().optional(),
  equipmentModel: z.string().optional(),
  score: z.number(),
});

/**
 * Zod schema validating the JSON response from the chatbot endpoint.
 */
export const chatResponseSchema = z.object({
  sessionId: z.string(),
  response: z.string(),
  timeline: z.array(timelineStepSchema),
});

/**
 * Zod schema validating a stored chat session context log.
 */
export const sessionSchema = z.object({
  _id: z.string(),
  tenantId: z.string(),
  messages: z.array(chatMessageSchema),
});
