import { AppState, Ticket, Staff, ChatMessage, TimelineStep, RAGHit } from '@/types';
import { clone } from '@/utils/fp';

/** Default maps for resolving tenant properties. */
export const tenantLeaseMap: Record<string, string> = {
  tenant_001: 'lease_nike_104',
  tenant_002: 'lease_adidas_105',
  tenant_003: 'lease_zara_106',
  tenant_004: 'lease_puma_107',
  tenant_005: 'lease_apple_108',
};

/** Default map for resolving tenant store names. */
export const tenantNameMap: Record<string, string> = {
  tenant_001: 'Nike Store',
  tenant_002: 'Adidas Store',
  tenant_003: 'Zara Store',
  tenant_004: 'Puma Store',
  tenant_005: 'Apple Store',
};

/** Default map for resolving tenant retail units. */
export const tenantUnitMap: Record<string, string> = {
  tenant_001: 'Unit 104',
  tenant_002: 'Unit 105',
  tenant_003: 'Unit 106',
  tenant_004: 'Unit 107',
  tenant_005: 'Unit 108',
};

/** The initial application state. */
export const initialState: AppState = {
  activeView: 'dashboard',
  currentTenant: 'tenant_001',
  currentLeaseId: 'lease_nike_104',
  chatSessionId: null,
  weather: {
    temp: '20°C',
    alert: null,
    desc: 'Clear Sky',
  },
  tickets: [],
  staff: [],
  rag: {
    target: 'all',
    leaseId: 'all',
    model: 'all',
    query: '',
    results: [],
    loading: false,
  },
  activeHitlTicket: null,
  loadingDashboard: false,
  loadingChat: false,
  chatMessages: [
    {
      role: 'system',
      content: 'Welcome to Operio. Enter your request below to run an autonomous dispatch loop.',
    },
  ],
  chatTimeline: [],
  activeHitlTab: 'inputs',
};

let currentState: AppState = clone(initialState);
type StoreListener = (state: AppState) => void;
let listeners: StoreListener[] = [];

/**
 * Gets a read-only copy of the current state.
 * 
 * @returns The current state object.
 */
export function getState(): AppState {
  return currentState;
}

/**
 * Subscribes a listener to store state updates.
 * 
 * @param listener Callback function triggered on update.
 * @returns A unsubscribe clean up function.
 */
export function subscribe(listener: StoreListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Dispatches an action (state reducer function) to transition the state.
 * 
 * @param reducer A pure state transformer function.
 */
export function dispatch(reducer: (state: AppState) => AppState): void {
  const nextState = reducer(currentState);
  currentState = nextState;
  listeners.forEach((l) => l(currentState));
}

// State Action Reducer Factories (FP helpers)

/**
 * Action: Switches the active view panel.
 */
export const setView = (view: 'dashboard' | 'tenanthub' | 'knowledge' | 'staff') => (state: AppState): AppState => ({
  ...state,
  activeView: view,
});

/**
 * Action: Changes the weather temperature and alert status.
 */
export const setWeather = (temp: string, desc: string, alert: string | null) => (state: AppState): AppState => ({
  ...state,
  weather: { temp, desc, alert },
});

/**
 * Action: Updates tickets and staff lists in state.
 */
export const setDashboardData = (tickets: Ticket[], staff: Staff[]) => (state: AppState): AppState => ({
  ...state,
  tickets,
  staff,
});

/**
 * Action: Sets active tenant in tenant chat, resetting session.
 */
export const setTenant = (tenantId: string) => (state: AppState): AppState => {
  const leaseId = tenantLeaseMap[tenantId] || 'lease_nike_104';
  const name = tenantNameMap[tenantId] || 'Nike Store';
  return {
    ...state,
    currentTenant: tenantId,
    currentLeaseId: leaseId,
    chatSessionId: null, // Reset session context on tenant swap
    chatMessages: [
      {
        role: 'system',
        content: `Swapped context to ${name}. Conversational context reset.`,
      },
    ],
    chatTimeline: [],
  };
};

/**
 * Action: Appends a single message to chat history.
 */
export const appendChatMessage = (msg: ChatMessage) => (state: AppState): AppState => ({
  ...state,
  chatMessages: [...state.chatMessages, msg],
});

/**
 * Action: Sets session loading state.
 */
export const setChatLoading = (loading: boolean) => (state: AppState): AppState => ({
  ...state,
  loadingChat: loading,
});

/**
 * Action: Updates chat response and session details.
 */
export const setChatResponse = (sessionId: string, response: string, timeline: TimelineStep[]) => (state: AppState): AppState => ({
  ...state,
  chatSessionId: sessionId,
  chatMessages: [...state.chatMessages, { role: 'model', content: response }],
  chatTimeline: timeline,
  loadingChat: false,
});

/**
 * Action: Clears conversational chat history.
 */
export const clearChat = () => (state: AppState): AppState => ({
  ...state,
  chatSessionId: null,
  chatMessages: [
    {
      role: 'system',
      content: 'Conversational context reset.',
    },
  ],
  chatTimeline: [],
});

/**
 * Action: Updates RAG search configurations.
 */
export const updateRagConfig = (updates: Partial<AppState['rag']>) => (state: AppState): AppState => ({
  ...state,
  rag: {
    ...state.rag,
    ...updates,
  },
});

/**
 * Action: Updates RAG search results list.
 */
export const setRagResults = (results: RAGHit[]) => (state: AppState): AppState => ({
  ...state,
  rag: {
    ...state.rag,
    results,
    loading: false,
  },
});

/**
 * Action: Sets active HITL ticket to inspect.
 */
export const setHitlTicket = (ticket: Ticket | null) => (state: AppState): AppState => ({
  ...state,
  activeHitlTicket: ticket,
  activeHitlTab: 'inputs',
});

/**
 * Action: Transitions the active tab inside HITL modal.
 */
export const setHitlTab = (tab: 'inputs' | 'payload') => (state: AppState): AppState => ({
  ...state,
  activeHitlTab: tab,
});

/**
 * Action: Replaces a staff member's record in the store.
 */
export const updateStaffMember = (updatedStaff: Staff) => (state: AppState): AppState => ({
  ...state,
  staff: state.staff.map((s) => (s._id === updatedStaff._id ? updatedStaff : s)),
});
