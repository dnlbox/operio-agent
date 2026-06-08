import { dispatch, getState, subscribe, setView, setDashboardData } from '@/state/store';
import { fetchTickets, fetchStaff } from '@/api/client';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { TenantHub } from '@/components/TenantHub';
import { KnowledgeBase } from '@/components/KnowledgeBase';
import { CitationDrawer, MOCK_CITATIONS } from '@/components/CitationDrawer';
import { HitlOverlay } from '@/components/HitlOverlay';
import { StaffPortal } from '@/components/StaffPortal';
import { qs } from '@/utils/dom';

// 1. Polyfill feature-detection for Invoker Commands
if (!('commandForElement' in HTMLButtonElement.prototype)) {
  import('invokers-polyfill')
    .then(() => console.log('Invoker Commands polyfill loaded.'))
    .catch((err) => console.error('Failed to load Invoker polyfill:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  // 2. Initialize Overlay Components
  const citationDrawer = new CitationDrawer();
  const hitlOverlay = new HitlOverlay(
    (ref) => citationDrawer.open(ref),
    () => fetchDashboardData()
  );

  // 3. Initialize Main View Components
  const sidebar = new Sidebar();
  const dashboard = new Dashboard((ticket) => {
    // When manager clicks "Review Approval", link the ticket full ObjectId to action triggers
    hitlOverlay.setFullTicketId(ticket._id);
    hitlOverlay.open(ticket, getState().staff, MOCK_CITATIONS);
  });
  const tenantHub = new TenantHub((ref) => citationDrawer.open(ref));
  const knowledgeBase = new KnowledgeBase();
  const staffPortal = new StaffPortal();

  // DOM view references
  const viewDashboard = qs('#view-dashboard');
  const viewTenantHub = qs('#view-tenanthub');
  const viewKnowledge = qs('#view-knowledge');
  const viewStaff = qs('#view-staff');

  /**
   * Fetches fresh tickets and staff status from the backend API, updating the store.
   */
  async function fetchDashboardData(): Promise<void> {
    try {
      const [tickets, staff] = await Promise.all([fetchTickets(), fetchStaff()]);
      dispatch(setDashboardData(tickets, staff));
    } catch (e) {
      console.error('Failed to retrieve fresh ledger items:', e);
    }
  }

  // 4. Central Render / Sync Loop (State Subscription)
  subscribe((state) => {
    // A. Switch panel view displays
    [viewDashboard, viewTenantHub, viewKnowledge, viewStaff].forEach((panel) => {
      panel.classList.remove('active-view');
    });

    if (state.activeView === 'dashboard') {
      viewDashboard.classList.add('active-view');
    } else if (state.activeView === 'tenanthub') {
      viewTenantHub.classList.add('active-view');
    } else if (state.activeView === 'knowledge') {
      viewKnowledge.classList.add('active-view');
    } else if (state.activeView === 'staff') {
      viewStaff.classList.add('active-view');
    }

    // B. Trigger component-specific rendering pipelines
    sidebar.render(state);
    
    if (state.activeView === 'dashboard') {
      dashboard.render(state);
    } else if (state.activeView === 'tenanthub') {
      tenantHub.render(state);
    } else if (state.activeView === 'knowledge') {
      knowledgeBase.render(state);
    } else if (state.activeView === 'staff') {
      staffPortal.render(state);
    }

    // C. Sync active HITL overlay tabs if open
    if (state.activeHitlTicket) {
      hitlOverlay.updateTabUI(state.activeHitlTab);
    }
  });

  // 5. Hash Routing Controller
  function syncRoute(): void {
    const hash = window.location.hash.substring(1);
    if (['dashboard', 'tenanthub', 'knowledge', 'staff'].includes(hash)) {
      dispatch(setView(hash as 'dashboard' | 'tenanthub' | 'knowledge' | 'staff'));
      if (hash === 'dashboard' || hash === 'staff') {
        fetchDashboardData();
      }
    } else {
      // Default fallback
      window.location.hash = 'dashboard';
    }
  }

  window.addEventListener('hashchange', syncRoute);
  
  // Trigger initial route match
  syncRoute();

  // 6. Polling: refresh dashboard queues every 10 seconds while viewing command center
  setInterval(() => {
    const state = getState();
    if (state.activeView === 'dashboard') {
      fetchDashboardData();
    }
  }, 10000);
});
