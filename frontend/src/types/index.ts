/**
 * Represents a work order ticket within the Operio dispatch system.
 */
export interface Ticket {
  /** The unique MongoDB identifier. */
  _id: string;
  /** The ID of the tenant who reported the issue. */
  tenantId: string;
  /** The specific equipment or asset ID (e.g. HVAC, Escalator). */
  assetId: string;
  /** A textual description of the reported issue. */
  description: string;
  /** The current status of the work order. */
  status: 'Pending Approval' | 'Dispatched' | 'Rejected' | 'Created';
  /** The ID of the technician assigned to this ticket, if any. */
  assignedTo: string | null;
  /** The estimated cost of the repair. */
  costEstimation: number;
  /** The determined liability for the work order. */
  leaseResponsibility: 'Tenant' | 'Landlord' | 'Unknown';
  /** The lease clause reference determining the liability. */
  leaseClauseRef: string | null;
  /** The severity or urgency level of the work order. */
  emergencyLevel: 'Routine' | 'Emergency';
  /** Optional CMMS payload preview details. */
  externalSystemPayload?: {
    source: string;
    externalId: string;
    action: string;
    costCenter: string;
  };
  /** The audit history trail of the work order. */
  timeline: Array<{
    status: string;
    timestamp: string;
    notes?: string;
  }>;
  /** Optional session ID that triggered this work order. */
  sessionId?: string;
}

/**
 * Represents an on-site technician staff member.
 */
export interface Staff {
  /** The unique technician ID. */
  _id: string;
  /** The full name of the technician. */
  name: string;
  /** The list of specialized skills the technician possesses. */
  skills: string[];
  /** The status of the technician. */
  status: 'Available' | 'Busy' | 'Offline';
  /** The physical mall sector where the technician is currently located. */
  currentLocation: string;
  /** Start time of the technician's shift (HH:MM). */
  shiftStart: string;
  /** End time of the technician's shift (HH:MM). */
  shiftEnd: string;
  /** The hourly rate charged by the technician ($). */
  ratePerHour: number;
}

/**
 * Represents a document hit returned from RAG Elasticsearch index search.
 */
export interface RAGHit {
  /** The unique ID of the document hit. */
  id: string;
  /** The index type: lease clause or manufacturer equipment manual. */
  type: 'leases' | 'manuals';
  /** The document title. */
  title: string;
  /** The matching text content snippet. */
  content: string;
  /** The URL to view the source PDF. */
  pdfUrl?: string;
  /** The lease ID context if type is 'leases'. */
  leaseId?: string;
  /** The equipment model code if type is 'manuals'. */
  equipmentModel?: string;
  /** The query match relevance score. */
  score: number;
}

/**
 * Represents a single message in a chat history.
 */
export interface ChatMessage {
  /** The sender role. */
  role: 'user' | 'model' | 'system';
  /** The message text content. */
  content: string;
}

/**
 * Represents a reasoning step in the agent reasoning loop.
 */
export interface TimelineStep {
  /** The node execution type. */
  type: 'thought' | 'tool_call' | 'tool_result' | 'response' | 'warning';
  /** The title of the execution step. */
  title: string;
  /** Detailed content or JSON payload string representation. */
  details: string;
}

/**
 * Represents the unified application state for the Vite SPA.
 */
export interface AppState {
  /** The currently active panel view. */
  activeView: 'dashboard' | 'tenanthub' | 'knowledge' | 'staff';
  /** The current active tenant ID context in the chat view. */
  currentTenant: string;
  /** The corresponding lease ID resolved for the current tenant. */
  currentLeaseId: string;
  /** The active chat session ID. */
  chatSessionId: string | null;
  /** The current environment weather conditions. */
  weather: {
    temp: string;
    alert: string | null;
    desc: string;
  };
  /** The list of all system work orders. */
  tickets: Ticket[];
  /** The list of all on-site technicians. */
  staff: Staff[];
  /** The state for the Knowledge RAG Explorer. */
  rag: {
    target: 'all' | 'leases' | 'manuals';
    leaseId: string;
    model: string;
    query: string;
    results: RAGHit[];
    loading: boolean;
  };
  /** The ticket currently being inspected in the HITL modal. */
  activeHitlTicket: Ticket | null;
  /** Loading states for the dashboard. */
  loadingDashboard: boolean;
  /** Loading states for chat responses. */
  loadingChat: boolean;
  /** Chat messages history. */
  chatMessages: ChatMessage[];
  /** Reasoning trace steps of the latest agent interaction. */
  chatTimeline: TimelineStep[];
  /** Active HITL modal tab. */
  activeHitlTab: 'inputs' | 'payload';
}
