import { AppState, Ticket, Staff, ChatMessage, TimelineStep, RAGHit } from '@/types';
import { clone } from '@/utils/fp';
import { create } from 'zustand';

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

/**
 * Action: Switches the active view panel.
 * 
 * @param view The name of the panel view.
 * @returns State updater function.
 */
export const setView = (view: 'dashboard' | 'tenanthub' | 'knowledge' | 'staff') => (state: AppState): AppState => ({
  ...state,
  activeView: view,
});

/**
 * Action: Changes the weather temperature and alert status.
 * 
 * @param temp The temperature string.
 * @param desc The description text.
 * @param alert Optional extreme alert warning.
 * @returns State updater function.
 */
export const setWeather = (temp: string, desc: string, alert: string | null) => (state: AppState): AppState => ({
  ...state,
  weather: { temp, desc, alert },
});

/**
 * Action: Updates tickets and staff lists in state.
 * 
 * @param tickets The list of work orders.
 * @param staff The list of technicians.
 * @returns State updater function.
 */
export const setDashboardData = (tickets: Ticket[], staff: Staff[]) => (state: AppState): AppState => ({
  ...state,
  tickets,
  staff,
});

/**
 * Action: Sets active tenant in tenant chat, resetting session.
 * 
 * @param tenantId The active tenant code.
 * @returns State updater function.
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
 * 
 * @param msg The message to append.
 * @returns State updater function.
 */
export const appendChatMessage = (msg: ChatMessage) => (state: AppState): AppState => ({
  ...state,
  chatMessages: [...state.chatMessages, msg],
});

/**
 * Action: Sets session loading state.
 * 
 * @param loading Boolean load state.
 * @returns State updater function.
 */
export const setChatLoading = (loading: boolean) => (state: AppState): AppState => ({
  ...state,
  loadingChat: loading,
});

/**
 * Action: Updates chat response and session details.
 * 
 * @param sessionId The active session ID.
 * @param response The text reply.
 * @param timeline The reasoning trace steps.
 * @returns State updater function.
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
 * 
 * @returns State updater function.
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
 * 
 * @param updates The configurations to patch.
 * @returns State updater function.
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
 * 
 * @param results The Elasticsearch hits.
 * @returns State updater function.
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
 * 
 * @param ticket The ticket object.
 * @returns State updater function.
 */
export const setHitlTicket = (ticket: Ticket | null) => (state: AppState): AppState => ({
  ...state,
  activeHitlTicket: ticket,
  activeHitlTab: 'inputs',
});

/**
 * Action: Transitions the active tab inside HITL modal.
 * 
 * @param tab The tab identifier name.
 * @returns State updater function.
 */
export const setHitlTab = (tab: 'inputs' | 'payload') => (state: AppState): AppState => ({
  ...state,
  activeHitlTab: tab,
});

/**
 * Action: Replaces a staff member's record in the store.
 * 
 * @param updatedStaff The technician record.
 * @returns State updater function.
 */
export const updateStaffMember = (updatedStaff: Staff) => (state: AppState): AppState => ({
  ...state,
  staff: state.staff.map((s) => (s._id === updatedStaff._id ? updatedStaff : s)),
});

/**
 * Interface defining properties and dispatcher actions in the Zustand store.
 */
export interface AppStateStore extends AppState {
  /** Dispatches a custom state reducer update function. */
  dispatch: (reducer: (state: AppState) => AppState) => void;
  /** Sets the active panel view. */
  setView: (view: 'dashboard' | 'tenanthub' | 'knowledge' | 'staff') => void;
  /** Updates weather values. */
  setWeather: (temp: string, desc: string, alert: string | null) => void;
  /** Sets current dashboard records. */
  setDashboardData: (tickets: Ticket[], staff: Staff[]) => void;
  /** Sets current active tenant. */
  setTenant: (tenantId: string) => void;
  /** Appends chat messages. */
  appendChatMessage: (msg: ChatMessage) => void;
  /** Sets chat loading spinner state. */
  setChatLoading: (loading: boolean) => void;
  /** Sets active chat conversation reply payload. */
  setChatResponse: (sessionId: string, response: string, timeline: TimelineStep[]) => void;
  /** Resets chat context logs. */
  clearChat: () => void;
  /** Updates RAG search configurations. */
  updateRagConfig: (updates: Partial<AppState['rag']>) => void;
  /** Sets active search hits. */
  setRagResults: (results: RAGHit[]) => void;
  /** Inspects active work order in dialog overlay. */
  setHitlTicket: (ticket: Ticket | null) => void;
  /** Toggles active HITL tab layout. */
  setHitlTab: (tab: 'inputs' | 'payload') => void;
  /** Patches on-site technician properties. */
  updateStaffMember: (updatedStaff: Staff) => void;
}

/**
 * Zustand hook creating and exposing the unified application store.
 */
export const useStore = create<AppStateStore>((set) => ({
  ...clone(initialState),
  dispatch: (reducer) => set((state) => reducer(state)),
  setView: (view) => set((state) => setView(view)(state)),
  setWeather: (temp, desc, alert) => set((state) => setWeather(temp, desc, alert)(state)),
  setDashboardData: (tickets, staff) => set((state) => setDashboardData(tickets, staff)(state)),
  setTenant: (tenantId) => set((state) => setTenant(tenantId)(state)),
  appendChatMessage: (msg) => set((state) => appendChatMessage(msg)(state)),
  setChatLoading: (loading) => set((state) => setChatLoading(loading)(state)),
  setChatResponse: (sessionId, response, timeline) => set((state) => setChatResponse(sessionId, response, timeline)(state)),
  clearChat: () => set((state) => clearChat()(state)),
  updateRagConfig: (updates) => set((state) => updateRagConfig(updates)(state)),
  setRagResults: (results) => set((state) => setRagResults(results)(state)),
  setHitlTicket: (ticket) => set((state) => setHitlTicket(ticket)(state)),
  setHitlTab: (tab) => set((state) => setHitlTab(tab)(state)),
  updateStaffMember: (updatedStaff) => set((state) => updateStaffMember(updatedStaff)(state)),
}));

/**
 * Legacy support: Gets a read-only copy of the current state.
 * 
 * @returns The current application state.
 */
export function getState(): AppState {
  return useStore.getState();
}

/**
 * Legacy support: Subscribes a listener to store state updates.
 * 
 * @param listener Callback function triggered on update.
 * @returns A cleanup function to unsubscribe the listener.
 */
export function subscribe(listener: (state: AppState) => void): () => void {
  return useStore.subscribe(listener);
}

/**
 * Legacy support: Dispatches an action (state reducer function) to transition the state.
 * 
 * @param reducer A pure state transformer function.
 */
export function dispatch(reducer: (state: AppState) => AppState): void {
  useStore.getState().dispatch(reducer);
}
