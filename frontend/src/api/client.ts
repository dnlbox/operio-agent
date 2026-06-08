import { Ticket, Staff, RAGHit, TimelineStep, ChatMessage } from '@/types';

const API_BASE = ''; // Relative to server root

/**
 * Interface representing a response from the chat endpoint.
 */
interface ChatResponse {
  sessionId: string;
  response: string;
  timeline: TimelineStep[];
}

/**
 * Fetches the current active work orders from the database.
 * 
 * @returns A promise resolving to an array of Tickets.
 */
export async function fetchTickets(): Promise<Ticket[]> {
  const res = await fetch(`${API_BASE}/api/tickets`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tickets: ${res.statusText}`);
  }
  return res.json() as Promise<Ticket[]>;
}

/**
 * Fetches the list of mall maintenance staff and their active workload status.
 * 
 * @returns A promise resolving to an array of Staff members.
 */
export async function fetchStaff(): Promise<Staff[]> {
  const res = await fetch(`${API_BASE}/api/staff`);
  if (!res.ok) {
    throw new Error(`Failed to fetch staff: ${res.statusText}`);
  }
  return res.json() as Promise<Staff[]>;
}

/**
 * Submits a chat message to the SRE dispatch agent.
 * 
 * @param tenantId The current tenant context ID.
 * @param message The user's text query or request.
 * @param sessionId Optional session identifier to maintain conversation history.
 * @param temp The outdoor temperature reading (e.g. 20°C).
 * @param alert Optional extreme weather warning alerts.
 * @returns A promise resolving to the chat reply and timeline trace.
 */
export async function sendChatMessage(
  tenantId: string,
  message: string,
  sessionId: string | null,
  temp: string,
  alert: string | null
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      message,
      sessionId,
      temperatureContext: temp,
      weatherAlertContext: alert,
    }),
  });

  if (!res.ok) {
    throw new Error(`Chat API error: ${res.statusText}`);
  }
  return res.json() as Promise<ChatResponse>;
}

/**
 * Performs vector/keyword search queries in Elasticsearch across leases or equipment manuals.
 * 
 * @param query The text to search.
 * @param type The document target index ('leases', 'manuals', or 'all').
 * @param leaseId Optional tenant lease isolation filter.
 * @param equipmentModel Optional equipment model isolation filter.
 * @returns A promise resolving to matching RAG hits.
 */
export async function searchKnowledgeBase(
  query: string,
  type: 'all' | 'leases' | 'manuals',
  leaseId?: string,
  equipmentModel?: string
): Promise<RAGHit[]> {
  let url = `${API_BASE}/api/docs/search?query=${encodeURIComponent(query)}`;
  if (type !== 'all') {
    url += `&type=${type}`;
  }
  if (leaseId && leaseId !== 'all') {
    url += `&leaseId=${leaseId}`;
  }
  if (equipmentModel && equipmentModel !== 'all') {
    url += `&equipmentModel=${encodeURIComponent(equipmentModel)}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`RAG search error: ${res.statusText}`);
  }
  return res.json() as Promise<RAGHit[]>;
}

/**
 * Authorizes a work order dispatch, assigning a technician and cost overrides.
 * 
 * @param ticketId The work order database ID.
 * @param assignedTo The technician staff ID.
 * @param costEstimation The approved maximum cost estimation ($).
 * @param managerNotes The dispatcher notes or overrides.
 * @returns A promise resolving to the updated Ticket result.
 */
export async function approveTicket(
  ticketId: string,
  assignedTo: string | null,
  costEstimation: number,
  managerNotes: string
): Promise<{ success: boolean; ticket: Ticket }> {
  const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedTo, costEstimation, managerNotes }),
  });

  if (!res.ok) {
    throw new Error(`Approve API error: ${res.statusText}`);
  }
  return res.json() as Promise<{ success: boolean; ticket: Ticket }>;
}

/**
 * Rejects and cancels a work order ticket.
 * 
 * @param ticketId The work order database ID.
 * @returns A promise resolving to the updated Ticket result.
 */
export async function rejectTicket(ticketId: string): Promise<{ success: boolean; ticket: Ticket }> {
  const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/reject`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`Reject API error: ${res.statusText}`);
  }
  return res.json() as Promise<{ success: boolean; ticket: Ticket }>;
}

/**
 * Updates a staff member's details (schedule, availability, skills, location).
 * 
 * @param staffId The unique staff member database ID.
 * @param updates Partial fields to update.
 * @returns A promise resolving to the updated Staff object.
 */
export async function updateStaff(staffId: string, updates: Partial<Staff>): Promise<Staff> {
  const res = await fetch(`${API_BASE}/api/staff/${staffId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error(`Failed to update staff member: ${res.statusText}`);
  }
  return res.json() as Promise<Staff>;
}

/**
 * Fetches the session messages log for a specific conversation session.
 * 
 * @param sessionId The conversation session ID.
 * @returns A promise resolving to the session record.
 */
export async function fetchSession(sessionId: string): Promise<{ _id: string; tenantId: string; messages: ChatMessage[] }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch session context: ${res.statusText}`);
  }
  return res.json() as Promise<{ _id: string; tenantId: string; messages: ChatMessage[] }>;
}
